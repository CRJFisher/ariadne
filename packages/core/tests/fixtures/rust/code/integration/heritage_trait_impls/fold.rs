// The trait and its default bodies - fold.rs

pub struct Item {}

pub trait DocFolder {
    fn fold_item(&mut self, item: Item) -> Option<Item> {
        Some(item)
    }

    fn fold_crate(&mut self, item: Item) -> Option<Item> {
        self.fold_item(item)
    }
}
