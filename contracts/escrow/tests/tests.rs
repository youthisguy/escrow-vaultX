#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, MockAuth},
    token, Address, Env, Vec, symbol_short,
};
use crate::Escrow;

#[test]
fn test_create_and_get_escrow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, Escrow);
    let client = Escrow::new(&env, &contract_id);

    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token_id = Address::generate(&env);

    let token = token::Client::new(&env, &token_id);
    token.mock_all_auths();
    token.mock_mint(&sender, &2_000_000i128);

    let recipients: Vec<(Address, u32)> = vec![&env, (recipient.clone(), 100)];

    let id = client.create(&sender, &recipients, &1_000_000i128, &token_id, &0u64);

    assert_eq!(id, 1u64);

    let escrow = client.get_escrow(&id);
    assert_eq!(escrow.amount, 1_000_000i128);
    assert_eq!(escrow.sender, sender);
    assert_eq!(escrow.recipients, recipients);
    assert_eq!(escrow.approved, false);
    assert_eq!(escrow.status, 0u32);
}

#[test]
fn test_create_approve_claim_single_recipient() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, Escrow);
    let client = Escrow::new(&env, &contract_id);

    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token_id = Address::generate(&env);

    let token = token::Client::new(&env, &token_id);
    token.mock_all_auths();
    token.mock_mint(&sender, &2_000_000i128);

    let recipients: Vec<(Address, u32)> = vec![&env, (recipient.clone(), 100)];

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
    let client = Escrow::new(&env, &contract_id);

    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token_id = Address::generate(&env);

    let recipients: Vec<(Address, u32)> = vec![&env, (recipient, 90)];

    let _id = client.create(&sender, &recipients, &1_000_000i128, &token_id, &0u64);
}