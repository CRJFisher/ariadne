use std::collections::HashMap;

pub struct Layer;

impl Layer {
    pub fn apply(&self) {}
}

pub struct Stack {
    layers: Vec<Layer>,
}

impl Stack {
    pub fn forward(&self) {
        for by_ref in &self.layers {
            by_ref.apply();
        }
    }
}

pub fn run_all(layers: Vec<Layer>, named: HashMap<String, Layer>) {
    for by_iter in layers.iter() {
        by_iter.apply();
    }
    for (position, counted) in layers.iter().enumerate() {
        counted.apply();
    }
    for (name, entry) in &named {
        entry.apply();
    }
    for value in named.values() {
        value.apply();
    }
    for pair in &named {
        pair.apply();
    }
}
