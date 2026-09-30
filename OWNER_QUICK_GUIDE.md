# Owner Quick Guide

This is everything you need to run your daily business on this system. No computer background needed — if you can use WhatsApp, you can use this.

**The daily flow is always the same:**

**Purchase → Cutting → Stock → Sale → Payment → Daily Result**

You buy raw chicken, cut it into pieces, sell the pieces (for cash or on credit), collect payments from credit customers, and check how the day went. That's the whole system.

---

## 1. Login

Open the app in your browser. Enter your username and password. Click **Sign in**.

You land on **Today's Business** — this is your home screen. It always shows how today looks: what you've sold, what's owed to you, what's in stock, and today's result.

---

## 2. New Purchase (buying raw chicken)

From **Today's Business**, click **New Purchase**.

Fill in: who you bought from, how much (KG), the rate you paid, and whether you paid in full, partly, or not yet. Click **Save Purchase**.

You'll see the total and the supplier's balance immediately.

---

## 3. Chicken Cutting (turning raw chicken into pieces)

From **Today's Business**, click **Cutting**.

- **Step 1:** How much raw chicken are you cutting (KG)?
- **Step 2:** How much of each piece did you get — Boneless, Breast, Tikka, Leg, Wings, Neck, Whole Chicken?
- **Step 3:** How much was waste/loss?

The screen shows **BALANCED** in green once your numbers add up (raw input = pieces + waste). If it says **NOT BALANCED**, check your numbers — the button to finish stays disabled until it's right.

Click **COMPLETE CUTTING**. Your stock of each piece goes up immediately, and raw chicken stock goes down.

---

## 4. New Sale (cash or credit)

From **Today's Business**, click **New Sale**.

- **CASH SALE** — for walk-in customers. Payment is assumed paid in full automatically.
- **CREDIT SALE** — for a named customer (hotel, restaurant, shop). Pick the customer from the list.

Add the product(s), how many KG, and the rate (it fills in automatically from your price list — you can adjust it for this one sale if needed). The total updates as you type.

Click **SAVE SALE**. You'll see the invoice number and what's still owed (if any) right away. You can print the invoice from this screen.

---

## 5. Receive Payment (collecting money owed to you)

From **Today's Business**, click **Receive Payment**, or go to a specific customer's page and click **Receive Payment** there.

Pick the customer (if not already chosen), see what they currently owe, type how much they're paying now. The screen shows what they'll still owe after this payment. Click **Receive Payment** to save it.

---

## 6. Check Stock

Click **Stock** in the left menu.

Two simple lists: **Raw Material** (your raw chicken) and **Finished Products** (your cut pieces), each showing how much you have and, for finished products, today's selling rate. Anything low is marked in red.

---

## 7. Check Customer Due (who owes you money)

Click **Customers** in the left menu, then click on a customer's name.

The **Amount Due** figure is what that customer owes you right now. It's in red if they owe you money. The **Ledger Summary** shows how that number was built: what they owed before, plus new credit sales, minus payments received.

---

## 8. Check Today's Result

Back on **Today's Business** (click **Today** in the menu), the last two boxes are:

- **Estimated Gross Profit** — what you made on today's sales after the cost of the chicken.
- **Estimated Operating Result** — Gross Profit minus today's expenses. This is your bottom line for the day.

Both say **"Estimated"** on purpose — see the note below.

---

## Important things to know

### Why does it say "Estimated Profit"?

The system doesn't track the exact cost of every single piece of chicken you ever bought. Instead, it works out one shared cost-per-KG for a whole cutting batch, based on the price of the raw chicken you entered for that batch. This is accurate enough to run the business day-to-day, but it is **not** a full accountant's profit calculation. Treat "Estimated Profit" as a strong guide, not a tax or audit figure.

### Keep your raw chicken price current

The cost used for "Estimated Profit" comes from the **Purchase Price** on the raw chicken product record. If you don't update it when raw chicken prices change, your profit estimates will drift — too high if raw chicken got more expensive, too low if it got cheaper. Whenever you buy raw chicken at a new rate, make sure that rate is what you record for the purchase — the system already picks that up automatically each time you complete a cutting.

### Backups are your responsibility

This system does not automatically back itself up to somewhere safe by default. Whoever manages the server/computer this runs on needs to schedule regular backups (see `README.md` in this project for the exact backup commands) and occasionally test that a backup can actually be restored. If the computer or database is lost without a backup, all your business records — sales, customers, stock history — go with it.

### Usernames and passwords are your responsibility

Every person who uses this system should have their **own** login, not a shared one — this keeps a clear record of who did what. Set a strong password for each person, and remove/disable a login the day someone stops working for you. Whoever holds the **Admin** login can see and change everything, including other people's access — guard that login carefully and don't share it beyond one or two trusted people.

---

## A note on roles

Not everyone sees every button — that's intentional, not a bug. A cashier can receive payments and add expenses but can't create a purchase; a store keeper can buy and cut chicken but can't take a sale. This matches who should be doing what in a real chicken shop. If someone needs access to something they can't see, an Admin or Manager can adjust their role under **Settings**.
