#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Vec};

mod events;

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Escrow(u64),
    NextId,
    UserCreated(Address),
    UserReceived(Address),
}

#[derive(Clone)]
#[contracttype]
pub struct EscrowData {
    pub sender:     Address,
    pub recipients: Vec<(Address, u32)>,
    pub amount:     i128,
    pub token:      Address,
    pub created_at: u64,
    pub deadline:   u64,
    pub approved:   bool,
    pub status:     u32,
}

#[contract]
pub struct Escrow;

#[contractimpl]
impl Escrow {
    pub fn create(
        env: Env,
        sender: Address,
        recipients: Vec<(Address, u32)>,
        amount: i128,
        token: Address,
        deadline: u64,
    ) -> u64 {
        sender.require_auth();
        assert!(amount > 0, "amount must be positive");
        assert!(!recipients.is_empty(), "at least one recipient required");

        let total_percentage: u32 = recipients.iter().map(|(_, p)| p).sum();
        assert!(total_percentage == 100, "percentages must sum to 100");

        let contract = env.current_contract_address();
        let client = token::Client::new(&env, &token);
        client.transfer(&sender, &contract, &amount);

        let id = Self::next_id(&env);

        let data = EscrowData {
            sender: sender.clone(),
            recipients: recipients.clone(),
            amount,
            token,
            created_at: env.ledger().timestamp(),
            deadline,
            approved: false,
            status: 0,
        };

        env.storage().instance().set(&DataKey::Escrow(id), &data);

        let sender_key = DataKey::UserCreated(sender);
        let mut sender_list: Vec<u64> = env
            .storage()
            .instance()
            .get(&sender_key)
            .unwrap_or(Vec::new(&env));
        sender_list.push_back(id);
        env.storage().instance().set(&sender_key, &sender_list);

        for (recipient, _) in recipients.iter() {
            let recipient_key = DataKey::UserReceived(recipient);
            let mut recipient_list: Vec<u64> = env
                .storage()
                .instance()
                .get(&recipient_key)
                .unwrap_or(Vec::new(&env));
            recipient_list.push_back(id);
            env.storage()
                .instance()
                .set(&recipient_key, &recipient_list);
        }

        events::created(&env, id, data.sender.clone(), amount, deadline);

        id
    }

    pub fn get_created_ids(env: Env, user: Address) -> Vec<u64> {
        env.storage()
            .instance()
            .get(&DataKey::UserCreated(user))
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_received_ids(env: Env, user: Address) -> Vec<u64> {
        env.storage()
            .instance()
            .get(&DataKey::UserReceived(user))
            .unwrap_or(Vec::new(&env))
    }

    pub fn approve(env: Env, id: u64) {
        let mut data: EscrowData = env
            .storage()
            .instance()
            .get(&DataKey::Escrow(id))
            .unwrap();

        data.sender.require_auth();
        assert_eq!(data.status, 0, "escrow not pending");
        assert!(!data.approved, "already approved");

        data.approved = true;
        data.status = 1;
        env.storage().instance().set(&DataKey::Escrow(id), &data);

        events::approved(&env, id, data.sender);
    }

    pub fn claim(env: Env, id: u64, caller: Address) {
        caller.require_auth();

        let mut data: EscrowData = env
            .storage()
            .instance()
            .get(&DataKey::Escrow(id))
            .unwrap();

        assert!(
            data.recipients.iter().any(|(r, _)| r == caller),
            "not a recipient"
        );
        assert!(data.approved, "escrow not approved");
        assert!(data.status == 1, "escrow not in claimable state");

        if data.deadline > 0 {
            assert!(
                env.ledger().timestamp() <= data.deadline,
                "deadline passed"
            );
        }

        data.status = 2;
        env.storage().instance().set(&DataKey::Escrow(id), &data);

        let client = token::Client::new(&env, &data.token);
        let contract = env.current_contract_address();

        for (recipient, percentage) in data.recipients.iter() {
            let share = data.amount * (percentage as i128) / 100;
            client.transfer(&contract, &recipient, &share);
            events::split_claimed(&env, id, recipient.clone(), share);
        }

        let mut recipient_list = Vec::new(&env);
        for (r, _) in data.recipients.iter() {
            recipient_list.push_back(r.clone());
        }

        events::claimed(&env, id, recipient_list);
    }

    pub fn refund(env: Env, id: u64) {
        let mut data: EscrowData = env
            .storage()
            .instance()
            .get(&DataKey::Escrow(id))
            .unwrap();

        data.sender.require_auth();
        assert!(data.status == 0 || data.status == 1, "cannot refund");
        assert!(
            data.deadline == 0 || env.ledger().timestamp() > data.deadline,
            "deadline not passed"
        );

        data.status = 3;
        env.storage().instance().set(&DataKey::Escrow(id), &data);

        let client = token::Client::new(&env, &data.token);
        let contract = env.current_contract_address();
        client.transfer(&contract, &data.sender, &data.amount);

        events::refunded(&env, id, data.sender);
    }

    pub fn get_escrow(env: Env, id: u64) -> EscrowData {
        env.storage()
            .instance()
            .get(&DataKey::Escrow(id))
            .unwrap()
    }

    fn next_id(env: &Env) -> u64 {
        let key = DataKey::NextId;
        let mut id: u64 = env.storage().instance().get(&key).unwrap_or(0);
        id += 1;
        env.storage().instance().set(&key, &id);
        id
    }
}
