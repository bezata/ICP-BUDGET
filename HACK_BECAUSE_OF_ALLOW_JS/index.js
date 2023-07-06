import { $query, $update, StableBTreeMap, match, Result, ic, Opt, Principal, $init, } from "azle";
//track the number of spenders
let spenderCount;
//store the spenders
const spenderStorage = new StableBTreeMap(1, 44, 1024);
//store the payments in the canister
const paymentStorage = new StableBTreeMap(0, 44, 1024);
let budget = { total: 0 };
//store the principal of ther admin
let appAdmin;
//initialize the owner of the app on deployment
$init;
export function init(admin) {
    appAdmin = Principal.fromText(admin);
}
;
//add spender by the admin
$update;
export function addSpender(payload) {
    if (!isAdmin(ic.caller().toString())) {
        return Result.Err("Only the admin can add spenders");
    }
    spenderCount = (spenderCount + 1);
    spenderStorage.insert(spenderCount, payload);
    return Result.Ok(spenderCount);
}
//delete spender by the admin
$update;
export function deleteSpender(id) {
    if (!isAdmin(ic.caller().toString())) {
        return Result.Err("Only the admin can delete spenders");
    }
    return match(spenderStorage.remove(id), {
        Some: () => { return Result.Ok("Spender deleted successfully"); },
        None: () => { return Result.Err("Cannot delete the spender"); }
    });
}
//check if admin
$query;
export function isAdmin(p) {
    if (appAdmin.toString() === p) {
        return true;
    }
    return false;
}
//check if is among the allowed spenders
$query;
export function isSpender(id) {
    const isspender = spenderStorage.values().filter((spender) => spender.id.toString() === id);
    if (isspender.length > 0) {
        return true;
    }
    return false;
}
//set the budget by the owner
$update;
export function setBudget(amount) {
    if (!isAdmin(ic.caller().toString())) {
        return Result.Err("Only the owner can set a budget");
    }
    budget = { total: amount };
    return Result.Ok(budget);
}
//create payment by the owner
$update;
export function createPayment(id, amount) {
    const caller = ic.caller().toString();
    if (isAdmin(caller) || isSpender(caller)) {
        const name = id;
        const totalPayments = getTotalPayments();
        if (totalPayments + amount > budget.total) {
            return Result.Err("Budget exceeded");
        }
        const newPayment = {
            id: name,
            amount: amount,
            createdAt: ic.time(),
            updatedAt: Opt.None,
        };
        paymentStorage.insert(newPayment.id, newPayment);
        return Result.Ok(newPayment);
    }
    return Result.Err("You are not authorized to create a payment");
}
//get budget amount from the contract
$query;
export function getBudget() {
    return Result.Ok(budget);
}
//read the details of the a specific payment
$query;
export function readPayment(id) {
    return match(paymentStorage.get(id), {
        Some: (payment) => Result.Ok(payment),
        None: () => Result.Err(`Payment with id=${id} not found`),
    });
}
//list all payments created by the admin
$query;
export function listPayments() {
    return Result.Ok(Array.from(paymentStorage.values()));
}
//update the details of the specific payment
$update;
export function updatePayment(id, amount) {
    if (!isAdmin(ic.caller().toString())) {
        return Result.Err("Only the owner can update a payment");
    }
    return match(paymentStorage.get(id), {
        None: () => Result.Err(`Payment with id=${id} not found`),
        Some: (payment) => {
            const totalPayments = getTotalPayments() - payment.amount;
            if (totalPayments + amount > budget.total) {
                return Result.Err("Budget exceeded");
            }
            const updatedPayment = {
                ...payment,
                amount: amount,
                updatedAt: Opt.Some(ic.time()),
            };
            paymentStorage.insert(id, updatedPayment);
            return Result.Ok(updatedPayment);
        }
    });
}
//delete a payment by the owner
$update;
export function deletePayment(id) {
    if (!isAdmin(ic.caller().toString())) {
        return Result.Err("Only the owner can delete a payment");
    }
    return match(paymentStorage.remove(id), {
        Some: (payment) => Result.Ok(payment),
        None: () => Result.Err(`Couldn't delete payment with id=${id}. Payment not found.`),
    });
}
//get total payments from the canister
$query;
export function getTotalPayments() {
    return Array.from(paymentStorage.values()).reduce((total, payment) => total + payment.amount, 0);
}
//get the total amount used on the budget as a poercent
$query;
export function getBudgetUsagePercentage() {
    const totalPayments = getTotalPayments();
    return (totalPayments / budget.total) * 100;
}
//get the remaining unsed amount on the budget
$query;
export function getRemainingBudget() {
    const totalPayments = getTotalPayments();
    return budget.total - totalPayments;
}
