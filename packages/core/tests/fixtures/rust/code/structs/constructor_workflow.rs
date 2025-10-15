// Constructor → type → method workflow - constructor_workflow.rs
// Tests: Associated function calls, type binding, method call chain in single file

#[derive(Debug, Clone)]
struct Product {
    name: String,
    price: f64,
    category: String,
    in_stock: bool,
}

impl Product {
    // Associated function - constructor
    fn new(name: String, price: f64, category: String) -> Self {
        Product {
            name,
            price,
            category,
            in_stock: true,
        }
    }

    // Associated function - default constructor
    fn default() -> Self {
        Product {
            name: String::from("Default Product"),
            price: 0.0,
            category: String::from("General"),
            in_stock: false,
        }
    }

    // Method with &self
    fn get_name(&self) -> &str {
        &self.name
    }

    // Method with &self
    fn get_price(&self) -> f64 {
        self.price
    }

    // Method with &mut self that returns &mut Self for chaining
    fn apply_discount(&mut self, percentage: f64) -> &mut Self {
        self.price = self.price * (1.0 - percentage / 100.0);
        self
    }

    // Method with &mut self that returns &mut Self for chaining
    fn mark_out_of_stock(&mut self) -> &mut Self {
        self.in_stock = false;
        self
    }

    // Method that returns owned String
    fn get_info(&self) -> String {
        format!(
            "{}: ${:.2} ({})",
            self.name,
            self.price,
            if self.in_stock { "In Stock" } else { "Out of Stock" }
        )
    }
}

fn main() {
    // Associated function call (constructor) creates instance with type binding
    let mut product = Product::new(
        String::from("Laptop"),
        1000.0,
        String::from("Electronics"),
    );

    // Method calls on constructed instance
    let product_name = product.get_name();
    let original_price = product.get_price();

    // Method chaining workflow
    let _chained_product = product.apply_discount(10.0).mark_out_of_stock();
    let final_price = product.get_price();
    let product_info = product.get_info();

    println!("Product: {}", product_name);
    println!("Original price: ${:.2}", original_price);
    println!("Final price: ${:.2}", final_price);
    println!("Info: {}", product_info);
}

// Function that demonstrates workflow in function scope
fn create_and_process_product() -> Product {
    let mut product = Product::new(
        String::from("Mouse"),
        25.0,
        String::from("Accessories"),
    );

    // Method calls within function
    let _name = product.get_name();
    product.apply_discount(5.0);

    product
}