export function attachOrders(customers, orders) {
  const result = []
  for (const c of customers) {
    const cOrders = []
    for (const o of orders) {
      if (o.customerId === c.id) cOrders.push(o)
    }
    result.push({ ...c, orders: cOrders })
  }
  return result
}
