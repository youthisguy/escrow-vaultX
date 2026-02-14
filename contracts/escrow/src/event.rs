use soroban_sdk::{Env, Symbol, symbol_short, vec, Address, Vec, Val};

pub fn escrow_created(
    env: &Env,
    id: u64,
    sender: Address,
    amount: i128,
    deadline: u64,
) {
    env.events().publish(
        (symbol_short!("escrow_created"), id),
        (sender, amount, deadline),
    );
}

pub fn escrow_approved(
    env: &Env,
    id: u64,
    sender: Address,
) {
    env.events().publish(
        (symbol_short!("escrow_approved"), id),
        sender,
    );
}

pub fn escrow_claimed(
    env: &Env,
    id: u64,
    recipient: Address,
) {
    env.events().publish(
        (symbol_short!("escrow_claimed"), id),
        recipient,
    );
}

pub fn escrow_refunded(
    env: &Env,
    id: u64,
    sender: Address,
) {
    env.events().publish(
        (symbol_short!("escrow_refunded"), id),
        sender,
    );
}

pub fn escrow_split_claimed(
    env: &Env,
    id: u64,
    recipient: Address,
    amount: i128,
) {
    env.events().publish(
        (symbol_short!("escrow_split_claimed"), id),
        (recipient, amount),
    );
}