use soroban_sdk::{symbol_short, Address, Env, Vec};

pub fn created(env: &Env, id: u64, sender: Address, amount: i128, deadline: u64) {
    env.events().publish(
        (symbol_short!("escrow"), symbol_short!("created"), id),
        (sender, amount, deadline),
    );
}

pub fn approved(env: &Env, id: u64, sender: Address) {
    env.events().publish(
        (symbol_short!("escrow"), symbol_short!("approved"), id),
        sender,
    );
}

pub fn split_claimed(env: &Env, id: u64, recipient: Address, amount: i128) {
    env.events().publish(
        (symbol_short!("escrow"), symbol_short!("splclaim"), id),
        (recipient, amount),
    );
}

pub fn claimed(env: &Env, id: u64, recipients: Vec<Address>) {
    env.events().publish(
        (symbol_short!("escrow"), symbol_short!("claimed"), id),
        recipients,
    );
}

pub fn refunded(env: &Env, id: u64, sender: Address) {
    env.events().publish(
        (symbol_short!("escrow"), symbol_short!("refunded"), id),
        sender,
    );
}