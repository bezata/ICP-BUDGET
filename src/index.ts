import {
  $query,
  $update,
  Record,
  StableBTreeMap,
  Vec,
  match,
  Result,
  nat64,
  ic,
  Opt,
} from "azle";
import { v4 as uuidv4 } from "uuid";

interface Payment {
  id: string;
  amount: number;
  createdAt: nat64;
}

const budgetStorage = new StableBTreeMap<string, Opt<number>>(0, 44, 1024);
const paymentStorage = new StableBTreeMap<string, Payment>(0, 44, 1024);

$update;
export function setBudget(amount: number): Result<undefined, string> {
  budgetStorage.insert("budget", Opt.Some(amount));
  return Result.Ok(undefined);
}

$update;
export function createPayment(amount: number): Result<Payment, string> {
  const budget = budgetStorage.get("budget");
  if (budget === Opt.None || budget.value === undefined) {
    return Result.Err("Budget not set");
  }

  const totalPayments = paymentStorage
    .values()
    .reduce((sum, payment) => sum + payment.amount, 0);

  if (totalPayments + amount > budget.value) {
    return Result.Err("Payment amount exceeds budget");
  }

  const payment: Payment = {
    id: uuidv4(),
    amount,
    createdAt: ic.time(),
  };

  paymentStorage.insert(payment.id, payment);
  return Result.Ok(payment);
}

$update;
export function updatePayment(
  id: string,
  amount: number
): Result<Payment, string> {
  const payment = paymentStorage.get(id);
  if (payment === Opt.None) {
    return Result.Err(`Payment with id=${id} not found`);
  }

  const budget = budgetStorage.get("budget");
  if (budget === Opt.None || budget.value === undefined) {
    return Result.Err("Budget not set");
  }

  const totalPayments = paymentStorage
    .values()
    .reduce((sum, p) => (p.id === id ? sum : sum + p.amount), 0);

  if (totalPayments + amount > budget.value) {
    return Result.Err("Payment amount exceeds budget");
  }

  const updatedPayment: Payment = {
    ...payment.value,
    amount,
    createdAt: payment.value.createdAt,
  };

  paymentStorage.insert(id, updatedPayment);
  return Result.Ok(updatedPayment);
}

$update;
export function deletePayment(id: string): Result<undefined, string> {
  const payment = paymentStorage.get(id);
  if (payment === Opt.None) {
    return Result.Err(`Payment with id=${id} not found`);
  }

  paymentStorage.remove(id);
  return Result.Ok(undefined);
}

$query;
export function getPayments(): Result<Vec<Payment>, string> {
  return Result.Ok(paymentStorage.values());
}

$query;
export function getBudget(): Result<number, string> {
  const budget = budgetStorage.get("budget");
  if (budget === Opt.None || budget.value === undefined) {
    return Result.Err("Budget not set");
  }

  return Result.Ok(budget.value);
}
