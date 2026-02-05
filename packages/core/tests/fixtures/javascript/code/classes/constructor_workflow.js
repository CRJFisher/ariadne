/**
 * Constructor → type → method workflow - constructor_workflow.js
 * Tests: Constructor call, type binding, method call chain in single file
 */

class Product {
  constructor(name, price, category) {
    this.name = name;
    this.price = price;
    this.category = category;
    this.inStock = true;
  }

  getName() {
    return this.name;
  }

  getPrice() {
    return this.price;
  }

  applyDiscount(percentage) {
    this.price = this.price * (1 - percentage / 100);
    return this;
  }

  markOutOfStock() {
    this.inStock = false;
    return this;
  }
}

// Constructor call creates instance with type binding
const product = new Product("Laptop", 1000, "Electronics");

// Method calls on constructed instance
const productName = product.getName();
const originalPrice = product.getPrice();

// Method chaining workflow
const discountedProduct = product.applyDiscount(10).markOutOfStock();
const finalPrice = discountedProduct.getPrice();

// Export for potential testing
export {
  Product,
  product,
  productName,
  originalPrice,
  finalPrice,
};