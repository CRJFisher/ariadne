// An implementer overriding one default, beside an inherent impl - cache.rs

use crate::fold::{DocFolder, Item};

pub struct CacheBuilder {
    depth: usize,
}

impl CacheBuilder {
    pub fn new() -> CacheBuilder {
        CacheBuilder { depth: 0 }
    }
}

impl DocFolder for CacheBuilder {
    fn fold_item(&mut self, item: Item) -> Option<Item> {
        self.depth += 1;
        Some(item)
    }

    fn fold_crate(&mut self, item: Item) -> Option<Item> {
        self.fold_item(item)
    }
}
