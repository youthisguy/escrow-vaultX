#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Vec};

mod events;

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Escrow(u64),
    NextId,
}

#[derive(Clone)]
#[contracttype]
pub struct EscrowData {
    sender: Address,
    recipients: Vec<(Address, u32)>,
    amount: i128,
    token: Address,
    created_at: u64,
    deadline: u64,
    approved: bool,
    status: u32,
}

#[contract]
pub struct Escrow;

#[contractimpl]
impl Escrow {
    pub fn initialize(
        env: Env,
        admin: Address,
    ) {
        assert!(
            !env.storage().instance().has(&DataKey::NextId),
            "already initialized"
        );

        env.storage().instance().set(&DataKey::NextId, &0u64);
        // TODO: store admin for future restricted functions
        // env.storage().instance().set(&DataKey::Admin, &admin);
    }

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

        let total_percentage: u32 = recipients.iter().map(|(_, p)| p).sum();
        assert!(total_percentage == 100, "percentages must sum to 100");

        let client = token::Client::new(&env, &token);
        client.transfer(&sender, &env.current_contract_address(), &amount);

        let id = Self::next_id(&env);

        let data = EscrowData {
            sender: sender.clone(),
            recipients,
            amount,
            token,
            created_at: env.ledger().timestamp(),
            deadline,
            approved: false,
            status: 0,
        };

        env.storage().instance().set(&DataKey::Escrow(id), &data);

        events::created(&env, id, sender, amount, deadline);

        id
    }

    pub fn approve(env: Env, id: u64) {
        let mut data: EscrowData = env.storage().instance().get(&DataKey::Escrow(id)).unwrap();
        data.sender.require_auth();
        assert_eq!(data.status, 0, "escrow not pending");
        assert!(!data.approved, "already approved");

        data.approved = true;
        env.storage().instance().set(&DataKey::Escrow(id), &data);

        events::approved(&env, id, data.sender);
    }

    pub fn claim(env: Env, id: u64, caller: Address) {
        caller.require_auth();

        let mut data: EscrowData = env.storage().instance().get(&DataKey::Escrow(id)).unwrap();

        assert!(data.recipients.iter().any(|(r, _)| r == caller), "not recipient");
        assert!(data.approved, "not approved");
        assert_eq!(data.status, 0, "escrow not pending");

        if data.deadline > 0 {
            assert!(env.ledger().timestamp() <= data.deadline, "deadline passed");
        }

        data.status = 2;
        env.storage().instance().set(&DataKey::Escrow(id), &data);

        let client = token::Client::new(&env, &data.token);
        for (recipient, percentage) in data.recipients.iter() {
            let share = data.amount * (percentage as i128) / 100;
            client.transfer(&env.current_contract_address(), &recipient, &share);
            events::split_claimed(&env, id, recipient.clone(), share);
        }

        events::claimed(&env, id, data.recipients);
    }

    pub fn refund(env: Env, id: u64) {
        let mut data: EscrowData = env.storage().instance().get(&DataKey::Escrow(id)).unwrap();
        data.sender.require_auth();
        assert!(data.status == 0 || data.status == 1, "cannot refund");

        if data.deadline > 0 {
            assert!(env.ledger().timestamp() > data.deadline, "deadline not passed");
        }

        data.status = 3;
        env.storage().instance().set(&DataKey::Escrow(id), &data);

        let client = token::Client::new(&env, &data.token);
        client.transfer(&env.current_contract_address(), &data.sender, &data.amount);

        events::refunded(&env, id, data.sender);
    }

    pub fn get_escrow(env: Env, id: u64) -> EscrowData {
        env.storage().instance().get(&DataKey::Escrow(id)).unwrap()
    }

    fn next_id(env: &Env) -> u64 {
        let key = DataKey::NextId;
        let mut id: u64 = env.storage().instance().get(&key).unwrap_or(0);
        id += 1;
        env.storage().instance().set(&key, &id);
        id
    }
}