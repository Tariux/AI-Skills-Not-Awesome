export function attachOrders(customers, orders) {
  const byCustomer = new Map()
  for (const o of orders) {
    const list = byCustomer.get(o.customerId)
    if (list) list.push(o)
    else byCustomer.set(o.customerId, [o])
  }
  return customers.map((c) => ({ ...c, orders: byCustomer.get(c.id) ?? [] }))
}
