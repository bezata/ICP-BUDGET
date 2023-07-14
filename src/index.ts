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

type Payment = Record<{
  id: string;
  amount: number;
  createdAt: nat64;
  updatedAt: Opt<nat64>;
  category: string; // Added category field for payment categorization
}>;

type Budget = Record<{
  total: number;
}>;

const paymentStorage = new StableBTreeMap<string, Payment>(0, 44, 1024);
let budget: Budget = { total: 0 };

$update;
export function setBudget(amount: number): Result<Budget, string> {
  budget = { total: amount };
  return Result.Ok(budget);
}

$update;
export function createPayment(
  id: string,
  amount: number,
  category: string
): Result<Payment, string> {
  const name = id;
  const totalPayments = getTotalPayments();
  if (totalPayments + amount > budget.total) {
    return Result.Err<Payment, string>("Budget exceeded");
  }
  const newPayment: Payment = {
    id: name,
    amount: amount,
    createdAt: ic.time(),
    updatedAt: Opt.None,
    category: category, // Set the provided category for the payment
  };
  paymentStorage.insert(newPayment.id, newPayment);
  return Result.Ok(newPayment);
}

$query;
export function getBudget(): Result<Budget, string> {
  return Result.Ok(budget);
}

$query;
export function readPayment(id: string): Result<Payment, string> {
  return match(paymentStorage.get(id), {
    Some: (payment) => Result.Ok<Payment, string>(payment),
    None: () => Result.Err<Payment, string>(`Payment with id=${id} not found`),
  });
}

$query;
export function listPayments(): Result<Vec<Payment>, string> {
  return Result.Ok(Array.from(paymentStorage.values()));
}

$update;
export function updatePayment(
  id: string,
  amount: number
): Result<Payment, string> {
  return match(paymentStorage.get(id), {
    Some: (payment) => {
      const totalPayments = getTotalPayments() - payment.amount;
      if (totalPayments + amount > budget.total) {
        return Result.Err<Payment, string>("Budget exceeded");
      }
      const updatedPayment = {
        ...payment,
        amount: amount,
        updatedAt: Opt.Some(ic.time()),
      };
      paymentStorage.insert(id, updatedPayment);
      return Result.Ok(updatedPayment);
    },
    None: () => Result.Err<Payment, string>(`Payment with id=${id} not found`),
  });
}

$update;
export function deletePayment(id: string): Result<Payment, string> {
  return match(paymentStorage.remove(id), {
    Some: (payment) => Result.Ok<Payment, string>(payment),
    None: () =>
      Result.Err<Payment, string>(
        `Couldn't delete payment with id=${id}. Payment not found.`
      ),
  });
}

$query;
export function getTotalPayments(): number {
  return Array.from(paymentStorage.values()).reduce(
    (total, payment) => total + payment.amount,
    0
  );
}

$query;
export function getBudgetUsagePercentage(): number {
  const totalPayments = getTotalPayments();
  return (totalPayments / budget.total) * 100;
}

$query;
export function getRemainingBudget(): number {
  const totalPayments = getTotalPayments();
  return budget.total - totalPayments;
}

$query;
export function filterPaymentsByCategory(
  category: string
): Result<Vec<Payment>, string> {
  const filteredPayments = Array.from(paymentStorage.values()).filter(
    (payment) => payment.category === category
  );
  return Result.Ok(filteredPayments);
}

$query;
export function sortPaymentsByAmount(
  ascending: boolean = true
): Result<Vec<Payment>, string> {
  const sortedPayments = Array.from(paymentStorage.values()).sort(
    (a, b) => (ascending ? a.amount - b.amount : b.amount - a.amount)
  );
  return Result.Ok(sortedPayments);
}

$update;
export function schedulePaymentReminder(
  id: string,
  reminderTime: nat64
): Result<Payment, string> {
  return match(paymentStorage.get(id), {
    Some: (payment) => {
      const updatedPayment = {
        ...payment,
        reminderTime: Opt.Some(reminderTime),
      };
      paymentStorage.insert(id, updatedPayment);
      return Result.Ok(updatedPayment);
    },
    None: () => Result.Err<Payment, string>(`Payment with id=${id} not found`),
  });
}

// a workaround to make uuid package work with Azle
globalThis.crypto = {
  getRandomValues: () => {
    let array = new Uint8Array(32);

    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }

    return array;
  },
};
