/**
 * Prototype-based OOP patterns
 * Tests: Traditional JavaScript prototype methods, constructor functions
 */

// Constructor function
function Vehicle(make, model) {
  this.make = make;
  this.model = model;
  this.started = false;
}

// Prototype methods
Vehicle.prototype.start = function() {
  this.started = true;
  return "Engine started";
};

Vehicle.prototype.stop = function() {
  this.started = false;
  return "Engine stopped";
};

Vehicle.prototype.getInfo = function() {
  return `${this.make} ${this.model}`;
};

// Another constructor function
function Car(make, model, doors) {
  Vehicle.call(this, make, model);
  this.doors = doors;
}

// Prototype inheritance
Car.prototype = Object.create(Vehicle.prototype);
Car.prototype.constructor = Car;

// Additional prototype methods for Car
Car.prototype.honk = function() {
  return "Beep beep!";
};

Car.prototype.getDoors = function() {
  return this.doors;
};

// Using prototype methods
const vehicle = new Vehicle("Toyota", "Camry");
const startResult = vehicle.start();
const vehicleInfo = vehicle.getInfo();

const car = new Car("Honda", "Civic", 4);
const carInfo = car.getInfo(); // Inherited method
const honkResult = car.honk();
const doorCount = car.getDoors();

// Function that uses prototype methods
function testVehicle(v) {
  const info = v.getInfo();
  const started = v.start();
  return { info, started };
}

const testResult = testVehicle(car);

module.exports = {
  Vehicle,
  Car,
  vehicle,
  car,
  startResult,
  vehicleInfo,
  carInfo,
  honkResult,
  doorCount,
  testResult,
  testVehicle,
};
