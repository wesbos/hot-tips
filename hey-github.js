function calculateBill(price, taxRate, tipRate) {
  const total = price + price * taxRate + price * tipRate;
  return total;
}
