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
  nat8,
  Principal,
  $init,
} from "azle";
import { v4 as uuidv4 } from "uuid";

//Record to store the payment details
type Payment = Record<{
  id: string;
  amount: number;
  createdAt: nat64;
  updatedAt: Opt<nat64>;
}>;

//Record to store the total budget amount
type Budget = Record<{
  total: number;
}>;

//Record to store the details about the spender
type Spender = Record<{
  id : Principal;
}>

//track the number of spenders
let spenderCount : nat8;

//store the spenders
const spenderStorage = new StableBTreeMap<nat8, Spender>(1,44,1024);

//store the payments in the canister
const paymentStorage = new StableBTreeMap<string, Payment>(0, 44, 1024);

let budget: Budget = { total: 0 };

//store the principal of ther admin
let appAdmin : Principal;


//initialize the owner of the app on deployment
$init;
export function init(admin : string) : void{
  appAdmin = Principal.fromText(admin)
};


//add spender by the admin
$update;
export function addSpender(payload : Spender) : Result<nat8,string>{
  if(!isAdmin(ic.caller().toString())){
    return Result.Err<nat8,string>("Only the admin can add spenders")
  }

  spenderCount = (spenderCount+1);
  spenderStorage.insert(spenderCount, payload);
  return Result.Ok<nat8,string>(spenderCount);
}


//delete spender by the admin
$update;
export function deleteSpender(id : nat8) : Result<string,string>{
  if(!isAdmin(ic.caller().toString())){
    return Result.Err<string,string>("Only the admin can delete spenders")
  }
  return match(spenderStorage.remove(id),{
    Some : () =>{ return Result.Ok<string,string>("Spender deleted successfully")},
    None : ()=>{ return Result.Err<string,string>("Cannot delete the spender")}
  });

}


//check if admin
$query;
export function isAdmin(p : string) : boolean{
  if(appAdmin.toString() === p){
    return true;
  }
  return false;
}

//check if is among the allowed spenders
$query;
export function isSpender( id : string) : boolean{
  const isspender = spenderStorage.values().filter((spender) => spender.id.toString() === id);
  if(isspender.length > 0){
      return true;
  }
  return false;
}



//set the budget by the owner
$update;
export function setBudget(amount: number): Result<Budget, string> {
  if(!isAdmin(ic.caller().toString())){
    return Result.Err<Budget,string>("Only the owner can set a budget")
  }
  budget = { total: amount };
  return Result.Ok(budget);
}


//create payment by the owner
$update;
export function createPayment(
  id: string,
  amount: number
): Result<Payment, string> {

  const caller = ic.caller().toString();
  if(isAdmin(caller) || isSpender(caller)){
  
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
  };
  paymentStorage.insert(newPayment.id, newPayment);
  return Result.Ok(newPayment);
}

return Result.Err<Payment,string>("You are not authorized to create a payment")
}



//get budget amount from the contract
$query;
export function getBudget(): Result<Budget, string> {
  return Result.Ok(budget);
}


//read the details of the a specific payment
$query;
export function readPayment(id: string): Result<Payment, string> {
  return match(paymentStorage.get(id), {
    Some: (payment) => Result.Ok<Payment, string>(payment),
    None: () => Result.Err<Payment, string>(`Payment with id=${id} not found`),
  });
}


//list all payments created by the admin
$query;
export function listPayments(): Result<Vec<Payment>, string> {
  return Result.Ok(Array.from(paymentStorage.values()));
}


//update the details of the specific payment
$update;
export function updatePayment(
  id: string,
  amount: number
): Result<Payment, string> {
  if(!isAdmin(ic.caller().toString())){
    return Result.Err<Payment,string>("Only the owner can update a payment")
  }
  return match(paymentStorage.get(id), {
    None: () => Result.Err<Payment, string>(`Payment with id=${id} not found`),
    Some : (payment)=>{ 
      const totalPayments = getTotalPayments() - payment.amount;
      if (totalPayments + amount > budget.total) {
        return Result.Err<Payment, string>("Budget exceeded");
      }
      const updatedPayment : Payment = {
            ...payment,
            amount: amount,
            updatedAt: Opt.Some(ic.time()),
          };

          paymentStorage.insert(id, updatedPayment);
        return Result.Ok<Payment,string>(updatedPayment)
    }
  });
}


//delete a payment by the owner
$update;
export function deletePayment(id: string): Result<Payment, string> {
  if(!isAdmin(ic.caller().toString())){
    return Result.Err<Payment,string>("Only the owner can delete a payment")
  }
  return match(paymentStorage.remove(id), {
    Some: (payment) => Result.Ok<Payment, string>(payment),
    None: () =>
      Result.Err<Payment, string>(
        `Couldn't delete payment with id=${id}. Payment not found.`
      ),
  });
}



//get total payments from the canister
$query;
export function getTotalPayments(): number {
  return Array.from(paymentStorage.values()).reduce(
    (total, payment) => total + payment.amount,
    0
  );
}


//get the total amount used on the budget as a poercent
$query;
export function getBudgetUsagePercentage(): number {
  const totalPayments = getTotalPayments();
  return (totalPayments / budget.total) * 100;
}


//get the remaining unsed amount on the budget
$query;
export function getRemainingBudget(): number {
  const totalPayments = getTotalPayments();
  return budget.total - totalPayments;
}
