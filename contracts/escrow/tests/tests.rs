use soroban_sdk::{
    testutils::Address as _,
    token, Address, Env, Vec,
};

use p2p::{Escrow, EscrowClient};

fn create_token<'a>(env: &'a Env, admin: &Address) -> (Address, token::Client<'a>) {
    let asset = env.register_stellar_asset_contract_v2(admin.clone());
    let admin_client = token::StellarAssetClient::new(env, &asset.address());
    admin_client.mint(admin, &10_000_000i128);
    let client = token::Client::new(env, &asset.address());
    (asset.address(), client)
}

#[test]
fn test_create_and_get_escrow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, Escrow);
    let client = EscrowClient::new(&env, &contract_id);

    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let (token_id, _) = create_token(&env, &sender);

    let mut recipients: Vec<(Address, u32)> = Vec::new(&env);
    recipients.push_back((recipient.clone(), 100u32));

    let id = client.create(&sender, &recipients, &1_000_000i128, &token_id, &0u64);

    assert_eq!(id, 1u64);

    let escrow = client.get_escrow(&id);
    assert_eq!(escrow.amount, 1_000_000i128);
    assert_eq!(escrow.sender, sender);
    assert_eq!(escrow.approved, false);
    assert_eq!(escrow.status, 0u32);
}

#[test]
fn test_create_approve_claim_single_recipient() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, Escrow);
    let client = EscrowClient::new(&env, &contract_id);

    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let (token_id, token) = create_token(&env, &sender);

    let mut recipients: Vec<(Address, u32)> = Vec::new(&env);
    recipients.push_back((recipient.clone(), 100u32));

    let id = client.create(&sender, &recipients, &1_000_000i128, &token_id, &0u64);
    client.approve(&id);
    client.claim(&id, &recipient);

    assert_eq!(token.balance(&recipient), 1_000_000i128);
    assert_eq!(token.balance(&contract_id), 0i128);

    let data = client.get_escrow(&id);
    assert_eq!(data.status, 2u32);
}

#[test]
#[should_panic(expected = "percentages must sum to 100")]
fn test_create_fails_on_invalid_percentage_sum() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, Escrow);
    let client = EscrowClient::new(&env, &contract_id);

    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let (token_id, _) = create_token(&env, &sender);

    let mut recipients: Vec<(Address, u32)> = Vec::new(&env);
    recipients.push_back((recipient.clone(), 90u32));

    client.create(&sender, &recipients, &1_000_000i128, &token_id, &0u64);
}