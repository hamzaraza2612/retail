using ChickenWholesale.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace ChickenWholesale.Api.Data.Seed;

public static class DbSeeder
{
    public static async Task SeedAsync(ApplicationDbContext db)
    {
        await db.Database.MigrateAsync();

        if (await db.Users.AnyAsync()) return; // already seeded

        // ---------------- Users ----------------
        var users = new[]
        {
            new User { Username = "admin", Email = "admin@chickenwholesale.pk", FullName = "System Admin", Role = UserRole.Admin, PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123") },
            new User { Username = "manager", Email = "manager@chickenwholesale.pk", FullName = "Business Manager", Role = UserRole.Manager, PasswordHash = BCrypt.Net.BCrypt.HashPassword("Manager@123") },
            new User { Username = "sales", Email = "sales@chickenwholesale.pk", FullName = "Sales Executive", Role = UserRole.Sales, PasswordHash = BCrypt.Net.BCrypt.HashPassword("Sales@123") },
            new User { Username = "cashier", Email = "cashier@chickenwholesale.pk", FullName = "Cashier", Role = UserRole.Cashier, PasswordHash = BCrypt.Net.BCrypt.HashPassword("Cashier@123") },
            new User { Username = "storekeeper", Email = "storekeeper@chickenwholesale.pk", FullName = "Store Keeper", Role = UserRole.StoreKeeper, PasswordHash = BCrypt.Net.BCrypt.HashPassword("Store@123") },
            new User { Username = "delivery", Email = "delivery@chickenwholesale.pk", FullName = "Delivery Staff", Role = UserRole.Delivery, PasswordHash = BCrypt.Net.BCrypt.HashPassword("Delivery@123") },
        };
        db.Users.AddRange(users);
        await db.SaveChangesAsync();
        var adminId = users[0].Id;

        // ---------------- Product Categories ----------------
        var categories = new[]
        {
            new ProductCategory { Name = "Whole Chicken" },
            new ProductCategory { Name = "Boneless" },
            new ProductCategory { Name = "Breast" },
            new ProductCategory { Name = "Leg" },
            new ProductCategory { Name = "Wings" },
            new ProductCategory { Name = "Thigh" },
            new ProductCategory { Name = "Mince" },
            new ProductCategory { Name = "Cuts" },
            new ProductCategory { Name = "Live Chicken" },
            new ProductCategory { Name = "Other" },
            new ProductCategory { Name = "Raw Material" },
        };
        db.ProductCategories.AddRange(categories);
        await db.SaveChangesAsync();
        ProductCategory Cat(string name) => categories.First(c => c.Name == name);

        // ---------------- Products ----------------
        // All products below predate the RawMaterial/FinishedProduct classification and
        // were already being purchased and sold directly — they're explicitly
        // FinishedProduct here (also the column's DB default, see migration
        // AddProcessingAndProductType) so nothing about their existing behavior changes.
        var products = new List<Product>
        {
            new() { SKU = "WC-001", Name = "Whole Chicken", Category = Cat("Whole Chicken"), Unit = UnitOfMeasure.KG, ProductType = ProductType.FinishedProduct, PurchasePrice = 480, SalePrice = 550, MinimumStock = 100, CurrentStock = 0, Description = "Fresh whole chicken" },
            new() { SKU = "LC-001", Name = "Live Chicken", Category = Cat("Live Chicken"), Unit = UnitOfMeasure.KG, ProductType = ProductType.FinishedProduct, PurchasePrice = 420, SalePrice = 480, MinimumStock = 200, CurrentStock = 0, Description = "Live broiler chicken" },
            new() { SKU = "CM-001", Name = "Chicken Meat", Category = Cat("Whole Chicken"), Unit = UnitOfMeasure.KG, ProductType = ProductType.FinishedProduct, PurchasePrice = 500, SalePrice = 580, MinimumStock = 80, CurrentStock = 0 },
            new() { SKU = "BC-001", Name = "Boneless Chicken", Category = Cat("Boneless"), Unit = UnitOfMeasure.KG, ProductType = ProductType.FinishedProduct, PurchasePrice = 650, SalePrice = 750, MinimumStock = 60, CurrentStock = 0 },
            new() { SKU = "BR-001", Name = "Chicken Breast", Category = Cat("Breast"), Unit = UnitOfMeasure.KG, ProductType = ProductType.FinishedProduct, PurchasePrice = 600, SalePrice = 700, MinimumStock = 50, CurrentStock = 0 },
            new() { SKU = "LG-001", Name = "Chicken Leg", Category = Cat("Leg"), Unit = UnitOfMeasure.KG, ProductType = ProductType.FinishedProduct, PurchasePrice = 520, SalePrice = 600, MinimumStock = 50, CurrentStock = 0 },
            new() { SKU = "WG-001", Name = "Chicken Wings", Category = Cat("Wings"), Unit = UnitOfMeasure.KG, ProductType = ProductType.FinishedProduct, PurchasePrice = 500, SalePrice = 580, MinimumStock = 40, CurrentStock = 0 },
            new() { SKU = "TH-001", Name = "Chicken Thigh", Category = Cat("Thigh"), Unit = UnitOfMeasure.KG, ProductType = ProductType.FinishedProduct, PurchasePrice = 540, SalePrice = 620, MinimumStock = 40, CurrentStock = 0 },
            new() { SKU = "QC-001", Name = "Chicken Qorma Cut", Category = Cat("Cuts"), Unit = UnitOfMeasure.KG, ProductType = ProductType.FinishedProduct, PurchasePrice = 490, SalePrice = 570, MinimumStock = 50, CurrentStock = 0 },
            new() { SKU = "KC-001", Name = "Chicken Karahi Cut", Category = Cat("Cuts"), Unit = UnitOfMeasure.KG, ProductType = ProductType.FinishedProduct, PurchasePrice = 500, SalePrice = 580, MinimumStock = 50, CurrentStock = 0 },
            new() { SKU = "TC-001", Name = "Chicken Tikka Cut", Category = Cat("Cuts"), Unit = UnitOfMeasure.KG, ProductType = ProductType.FinishedProduct, PurchasePrice = 510, SalePrice = 590, MinimumStock = 40, CurrentStock = 0 },
            new() { SKU = "MN-001", Name = "Chicken Mince", Category = Cat("Mince"), Unit = UnitOfMeasure.KG, ProductType = ProductType.FinishedProduct, PurchasePrice = 560, SalePrice = 650, MinimumStock = 30, CurrentStock = 0 },
            new() { SKU = "OT-001", Name = "Chicken Liver", Category = Cat("Other"), Unit = UnitOfMeasure.KG, ProductType = ProductType.FinishedProduct, PurchasePrice = 350, SalePrice = 420, MinimumStock = 20, CurrentStock = 0 },
            new() { SKU = "OT-002", Name = "Chicken Skin", Category = Cat("Other"), Unit = UnitOfMeasure.KG, ProductType = ProductType.FinishedProduct, PurchasePrice = 150, SalePrice = 200, MinimumStock = 20, CurrentStock = 0 },
            new() { SKU = "OT-003", Name = "Chicken Feet", Category = Cat("Other"), Unit = UnitOfMeasure.KG, ProductType = ProductType.FinishedProduct, PurchasePrice = 120, SalePrice = 170, MinimumStock = 20, CurrentStock = 0 },
            new() { SKU = "NK-001", Name = "Chicken Neck", Category = Cat("Other"), Unit = UnitOfMeasure.KG, ProductType = ProductType.FinishedProduct, PurchasePrice = 200, SalePrice = 260, MinimumStock = 15, CurrentStock = 0 },
            // The one RawMaterial product in the demo data: consumed by processing
            // batches, never sold directly. See BUSINESS_WORKFLOW.md "Processing & Costing".
            new() { SKU = "RM-001", Name = "Raw Chicken (Whole Bird)", Category = Cat("Raw Material"), Unit = UnitOfMeasure.KG, ProductType = ProductType.RawMaterial, PurchasePrice = 550, SalePrice = 550, MinimumStock = 200, CurrentStock = 0, Description = "Whole raw bird purchased for cutting/processing" },
        };
        db.Products.AddRange(products);
        await db.SaveChangesAsync();
        Product Prod(string sku) => products.First(p => p.SKU == sku);

        // ---------------- Suppliers ----------------
        var suppliers = new List<Supplier>
        {
            new() { SupplierCode = "SUPP-2026-00001", Name = "ABC Poultry Farm", ContactPerson = "Rashid Ali", Phone = "0300-1112222", City = "Lahore", SupplierType = SupplierType.LiveChicken, OpeningBalance = 0, CurrentBalance = 0 },
            new() { SupplierCode = "SUPP-2026-00002", Name = "Al-Madina Chicken Supply", ContactPerson = "Imran Sheikh", Phone = "0301-2223333", City = "Lahore", SupplierType = SupplierType.ChickenMeat, OpeningBalance = 0, CurrentBalance = 0 },
            new() { SupplierCode = "SUPP-2026-00003", Name = "Punjab Poultry Traders", ContactPerson = "Waseem Akram", Phone = "0302-3334444", City = "Faisalabad", SupplierType = SupplierType.LiveChicken, OpeningBalance = 0, CurrentBalance = 0 },
            new() { SupplierCode = "SUPP-2026-00004", Name = "Fresh Pack Packaging", ContactPerson = "Ahmed Raza", Phone = "0303-4445555", City = "Lahore", SupplierType = SupplierType.Packaging, OpeningBalance = 0, CurrentBalance = 0 },
            new() { SupplierCode = "SUPP-2026-00005", Name = "National Feed & Farms", ContactPerson = "Tariq Javed", Phone = "0304-5556666", City = "Sheikhupura", SupplierType = SupplierType.RawMaterial, OpeningBalance = 0, CurrentBalance = 0 },
        };
        db.Suppliers.AddRange(suppliers);
        await db.SaveChangesAsync();

        // ---------------- Customers ----------------
        var customerData = new (string Name, string Type, string City)[]
        {
            ("Restaurant XYZ", "Restaurant", "Lahore"),
            ("Hotel Grand View", "Hotel", "Lahore"),
            ("Spicy Kitchen Caterers", "Caterer", "Lahore"),
            ("Al-Fateh Meat Shop", "Shop", "Lahore"),
            ("Metro Wholesale Mart", "Wholesale", "Lahore"),
            ("Broast House", "Restaurant", "Karachi"),
            ("Karahi Point", "Restaurant", "Lahore"),
            ("City Hotel & Suites", "Hotel", "Islamabad"),
            ("Green Valley Caterers", "Caterer", "Lahore"),
            ("Ahmed Traders", "Individual", "Lahore"),
        };
        var customers = new List<Customer>();
        var typeMap = new Dictionary<string, CustomerType>
        {
            ["Restaurant"] = CustomerType.Restaurant,
            ["Hotel"] = CustomerType.Hotel,
            ["Caterer"] = CustomerType.Caterer,
            ["Shop"] = CustomerType.Shop,
            ["Wholesale"] = CustomerType.Wholesale,
            ["Individual"] = CustomerType.Individual,
        };
        int idx = 1;
        foreach (var c in customerData)
        {
            customers.Add(new Customer
            {
                CustomerCode = $"CUST-2026-{idx:D5}",
                BusinessName = c.Name,
                ContactPerson = c.Name.Split(' ')[0],
                Phone = $"03{idx:D2}-{1000000 + idx * 137}",
                City = c.City,
                CustomerType = typeMap[c.Type],
                CreditLimit = 200000,
                PaymentTerms = "15 Days",
                OpeningBalance = 0,
                CurrentBalance = 0,
                IsActive = true
            });
            idx++;
        }
        // Standing walk-in/cash customer (section 12): retail counter sales that don't
        // warrant a full customer profile are recorded as an ordinary, fully-paid sales
        // order against this one customer, using 100% existing order/invoice/payment
        // code — see BUSINESS_WORKFLOW.md "Cash retail vs credit sales". Its balance stays
        // 0 by construction since these sales are always paid in full at confirmation.
        var walkInCustomer = new Customer
        {
            CustomerCode = "CASH-001",
            BusinessName = "Walk-in / Cash Customer",
            Phone = "N/A",
            CustomerType = CustomerType.Individual,
            CreditLimit = 0,
            PaymentTerms = "Cash on delivery",
            OpeningBalance = 0,
            CurrentBalance = 0,
            IsActive = true,
            Notes = "System customer for walk-in retail/cash sales — not a real business. Do not deactivate."
        };
        customers.Add(walkInCustomer);
        db.Customers.AddRange(customers);
        await db.SaveChangesAsync();

        // ---------------- Sample Purchases (increase stock) ----------------
        var rnd = new Random(42);
        var purchaseNo = 1;
        foreach (var supplier in suppliers.Take(3))
        {
            var purchaseProducts = products.Where(p => p.Category!.Name is "Whole Chicken" or "Live Chicken").Take(2).ToList();
            var items = new List<PurchaseItem>();
            decimal subtotal = 0;
            foreach (var p in purchaseProducts)
            {
                var qty = 300 + rnd.Next(0, 200);
                var rate = p.PurchasePrice;
                var total = qty * rate;
                subtotal += total;
                items.Add(new PurchaseItem { Product = p, Quantity = qty, Unit = p.Unit, Rate = rate, Total = total });
                p.CurrentStock += qty;
                db.InventoryTransactions.Add(new InventoryTransaction
                {
                    Product = p,
                    MovementType = InventoryMovementType.PURCHASE,
                    Quantity = qty,
                    Unit = p.Unit,
                    ReferenceType = "Purchase",
                    StockAfter = p.CurrentStock,
                    Date = DateTime.UtcNow.AddDays(-rnd.Next(1, 6)),
                    UserId = adminId,
                    Notes = "Seed data"
                });
            }
            var paid = subtotal * 0.6m;
            var purchase = new Purchase
            {
                PurchaseNumber = $"PO-2026-{purchaseNo:D5}",
                Supplier = supplier,
                PurchaseDate = DateTime.UtcNow.AddDays(-rnd.Next(1, 6)),
                InvoiceNumber = $"SUPINV-{1000 + purchaseNo}",
                Subtotal = subtotal,
                TotalAmount = subtotal,
                PaidAmount = paid,
                RemainingAmount = subtotal - paid,
                Status = PurchaseStatus.Confirmed,
                CreatedByUserId = adminId,
                Items = items
            };
            supplier.CurrentBalance += (subtotal - paid);
            db.Purchases.Add(purchase);
            purchaseNo++;
        }
        await db.SaveChangesAsync();

        // ---------------- Sample Sales Orders + Invoices + Payments ----------------
        var orderNo = 1;
        var invoiceNo = 1;
        var paymentNo = 1;
        foreach (var customer in customers.Take(6))
        {
            var orderProducts = products.Where(p => p.CurrentStock > 50).OrderBy(_ => rnd.Next()).Take(2).ToList();
            if (orderProducts.Count == 0) continue;

            var items = new List<SalesOrderItem>();
            decimal subtotal = 0;
            foreach (var p in orderProducts)
            {
                var qty = Math.Min(20 + rnd.Next(0, 30), p.CurrentStock);
                var rate = p.SalePrice;
                var total = qty * rate;
                subtotal += total;
                items.Add(new SalesOrderItem { Product = p, Quantity = qty, Unit = p.Unit, Rate = rate, Total = total });
            }
            var discount = Math.Round(subtotal * 0.02m, 2);
            var deliveryCharges = 500;
            var grandTotal = subtotal - discount + deliveryCharges;
            var paidAmount = rnd.Next(0, 2) == 0 ? grandTotal : Math.Round(grandTotal * 0.5m, 2);
            var remaining = grandTotal - paidAmount;

            var order = new SalesOrder
            {
                OrderNumber = $"SO-2026-{orderNo:D5}",
                Customer = customer,
                OrderDate = DateTime.UtcNow.AddDays(-rnd.Next(0, 5)),
                DeliveryDate = DateTime.UtcNow.AddDays(-rnd.Next(0, 3)),
                Subtotal = subtotal,
                Discount = discount,
                DeliveryCharges = deliveryCharges,
                GrandTotal = grandTotal,
                PaidAmount = paidAmount,
                RemainingAmount = remaining,
                Status = SalesOrderStatus.Delivered,
                PaymentStatus = remaining <= 0 ? PaymentStatus.Paid : (paidAmount > 0 ? PaymentStatus.Partial : PaymentStatus.Unpaid),
                StockDeducted = true,
                CreatedByUserId = adminId,
                Items = items
            };
            db.SalesOrders.Add(order);

            foreach (var it in items)
            {
                it.Product!.CurrentStock -= it.Quantity;
                db.InventoryTransactions.Add(new InventoryTransaction
                {
                    Product = it.Product,
                    MovementType = InventoryMovementType.SALE,
                    Quantity = it.Quantity,
                    Unit = it.Unit,
                    ReferenceType = "SalesOrder",
                    StockAfter = it.Product.CurrentStock,
                    Date = order.OrderDate,
                    UserId = adminId,
                    Notes = "Seed data"
                });
            }

            var invoice = new Invoice
            {
                InvoiceNumber = $"INV-2026-{invoiceNo:D5}",
                SalesOrder = order,
                Customer = customer,
                InvoiceDate = order.OrderDate,
                Subtotal = subtotal,
                Discount = discount,
                DeliveryCharges = deliveryCharges,
                GrandTotal = grandTotal,
                PaidAmount = paidAmount,
                BalanceAmount = remaining,
                PaymentStatus = order.PaymentStatus
            };
            db.Invoices.Add(invoice);

            if (paidAmount > 0)
            {
                db.Payments.Add(new Payment
                {
                    PaymentNumber = $"PAY-2026-{paymentNo:D5}",
                    Customer = customer,
                    Invoice = invoice,
                    Amount = paidAmount,
                    PaymentDate = order.OrderDate,
                    Method = PaymentMethod.Cash,
                    CreatedByUserId = adminId
                });
                paymentNo++;
            }

            customer.CurrentBalance += remaining;
            orderNo++;
            invoiceNo++;
        }
        await db.SaveChangesAsync();

        // ---------------- Processing / Cutting demo data ----------------
        // A worked example matching BUSINESS_WORKFLOW.md exactly: buy 500KG of raw whole
        // bird, then process all of it into six cuts plus waste, so the Processing screen,
        // Yield report, and product costing have real data to show from first login.
        var rawChicken = Prod("RM-001");
        var supplierForRaw = suppliers[0];
        {
            var qty = 500m;
            var rate = rawChicken.PurchasePrice; // 550/KG
            var total = qty * rate;
            rawChicken.CurrentStock += qty;
            db.InventoryTransactions.Add(new InventoryTransaction
            {
                Product = rawChicken,
                MovementType = InventoryMovementType.PURCHASE,
                Quantity = qty,
                Unit = rawChicken.Unit,
                ReferenceType = "Purchase",
                StockAfter = rawChicken.CurrentStock,
                Date = DateTime.UtcNow.AddDays(-1),
                UserId = adminId,
                Notes = "Seed data",
                UnitCost = rate
            });
            var paid = total * 0.6m;
            db.Purchases.Add(new Purchase
            {
                PurchaseNumber = $"PO-2026-{purchaseNo:D5}",
                Supplier = supplierForRaw,
                PurchaseDate = DateTime.UtcNow.AddDays(-1),
                InvoiceNumber = $"SUPINV-{1000 + purchaseNo}",
                Subtotal = total,
                TotalAmount = total,
                PaidAmount = paid,
                RemainingAmount = total - paid,
                Status = PurchaseStatus.Confirmed,
                CreatedByUserId = adminId,
                Items = new List<PurchaseItem> { new() { Product = rawChicken, Quantity = qty, Unit = rawChicken.Unit, Rate = rate, Total = total } }
            });
            supplierForRaw.CurrentBalance += (total - paid);
            purchaseNo++;
        }
        await db.SaveChangesAsync();

        var processingBatchNo = 1;
        {
            const decimal inputQty = 500m;
            var outputPlan = new (string Sku, decimal Qty)[]
            {
                ("BC-001", 150m), // Boneless
                ("BR-001", 70m),  // Breast
                ("TC-001", 80m),  // Tikka
                ("LG-001", 90m),  // Leg
                ("WG-001", 50m),  // Wings
                ("NK-001", 20m),  // Neck
                ("WC-001", 20m),  // Whole Chicken
            };
            const decimal wasteQty = 20m; // inputQty = sum(outputPlan.Qty) + wasteQty = 480 + 20 = 500

            var batch = new ProcessingBatch
            {
                BatchNumber = $"PB-2026-{processingBatchNo:D5}",
                ProcessingDate = DateTime.UtcNow,
                Status = ProcessingBatchStatus.Completed,
                WasteQuantity = wasteQty,
                WasteUnit = UnitOfMeasure.KG,
                WasteReason = "Trimming and processing loss",
                Notes = "Seed data — demonstrates the full processing/costing workflow",
                CreatedByUserId = adminId
            };

            var inputUnitCost = rawChicken.PurchasePrice;
            var allocatableCost = inputQty * inputUnitCost;
            batch.Inputs.Add(new ProcessingInput { Product = rawChicken, Quantity = inputQty, Unit = rawChicken.Unit, UnitCost = inputUnitCost, TotalCost = allocatableCost });

            var totalOutputQty = outputPlan.Sum(o => o.Qty);
            var baseUnitCost = Math.Round(allocatableCost / totalOutputQty, 4);

            foreach (var (sku, qty) in outputPlan)
            {
                var product = Prod(sku);
                var allocatedCost = Math.Round(qty * baseUnitCost, 2);
                batch.Outputs.Add(new ProcessingOutput { Product = product, Quantity = qty, Unit = product.Unit, UnitCost = baseUnitCost, AllocatedCost = allocatedCost });
                product.PurchasePrice = baseUnitCost;
            }

            db.ProcessingBatches.Add(batch);

            rawChicken.CurrentStock -= inputQty;
            db.InventoryTransactions.Add(new InventoryTransaction
            {
                Product = rawChicken,
                MovementType = InventoryMovementType.PROCESSING_OUT,
                Quantity = inputQty,
                Unit = rawChicken.Unit,
                ReferenceType = "ProcessingBatch",
                StockAfter = rawChicken.CurrentStock,
                Date = batch.ProcessingDate,
                UserId = adminId,
                Notes = $"Processing batch {batch.BatchNumber}",
                UnitCost = inputUnitCost
            });

            foreach (var (sku, qty) in outputPlan)
            {
                var product = Prod(sku);
                product.CurrentStock += qty;
                db.InventoryTransactions.Add(new InventoryTransaction
                {
                    Product = product,
                    MovementType = InventoryMovementType.PROCESSING_IN,
                    Quantity = qty,
                    Unit = product.Unit,
                    ReferenceType = "ProcessingBatch",
                    StockAfter = product.CurrentStock,
                    Date = batch.ProcessingDate,
                    UserId = adminId,
                    Notes = $"Processing batch {batch.BatchNumber}",
                    UnitCost = baseUnitCost
                });
            }
            processingBatchNo++;
        }
        await db.SaveChangesAsync();

        // ---------------- Expense Categories & Sample Expenses ----------------
        var expenseCategories = new[]
        {
            new ExpenseCategory { Name = "Electricity" },
            new ExpenseCategory { Name = "Fuel" },
            new ExpenseCategory { Name = "Rent" },
            new ExpenseCategory { Name = "Salaries" },
            new ExpenseCategory { Name = "Transport" },
            new ExpenseCategory { Name = "Packaging" },
            new ExpenseCategory { Name = "Maintenance" },
            new ExpenseCategory { Name = "Repairs" },
            new ExpenseCategory { Name = "Food" },
            new ExpenseCategory { Name = "Miscellaneous" },
        };
        db.ExpenseCategories.AddRange(expenseCategories);
        await db.SaveChangesAsync();

        db.Expenses.AddRange(
            new Expense { Category = expenseCategories[1], Amount = 5000, Date = DateTime.UtcNow.AddDays(-1), PaidBy = "Admin", PaymentMethod = PaymentMethod.Cash, Description = "Delivery van fuel", CreatedByUserId = adminId },
            new Expense { Category = expenseCategories[0], Amount = 15000, Date = DateTime.UtcNow.AddDays(-2), PaidBy = "Admin", PaymentMethod = PaymentMethod.BankTransfer, Description = "Monthly electricity bill", CreatedByUserId = adminId },
            new Expense { Category = expenseCategories[5], Amount = 3200, Date = DateTime.UtcNow, PaidBy = "Store Keeper", PaymentMethod = PaymentMethod.Cash, Description = "Packaging bags", CreatedByUserId = adminId }
        );
        await db.SaveChangesAsync();

        // ---------------- Employees ----------------
        var employees = new[]
        {
            new Employee { EmployeeCode = "EMP-2026-00001", Name = "Bilal Hussain", Phone = "0311-1111111", Role = "Driver", Department = "Delivery", JoiningDate = DateTime.UtcNow.AddMonths(-8), Salary = 35000, Status = EmployeeStatus.Active },
            new Employee { EmployeeCode = "EMP-2026-00002", Name = "Kashif Mehmood", Phone = "0322-2222222", Role = "Store Keeper", Department = "Warehouse", JoiningDate = DateTime.UtcNow.AddMonths(-14), Salary = 40000, Status = EmployeeStatus.Active },
            new Employee { EmployeeCode = "EMP-2026-00003", Name = "Nadeem Iqbal", Phone = "0333-3333333", Role = "Processing Staff", Department = "Processing", JoiningDate = DateTime.UtcNow.AddMonths(-20), Salary = 32000, Status = EmployeeStatus.Active },
            new Employee { EmployeeCode = "EMP-2026-00004", Name = "Waqas Ahmed", Phone = "0344-4444444", Role = "Delivery Staff", Department = "Delivery", JoiningDate = DateTime.UtcNow.AddMonths(-5), Salary = 30000, Status = EmployeeStatus.Active }
        };
        db.Employees.AddRange(employees);
        await db.SaveChangesAsync();

        // Link the demo "delivery" login to its driver Employee record, so the Delivery
        // role can be scoped to only the deliveries assigned to that employee. Waqas Ahmed
        // (EMP-2026-00004) is left unlinked to any login, standing in for "another driver"
        // whose deliveries the demo delivery user must not be able to see or update.
        users[5].EmployeeId = employees[0].Id;
        await db.SaveChangesAsync();

        db.AuditLogs.Add(new AuditLog { UserId = adminId, UserName = "admin", Action = "SEED", Entity = "System", EntityId = "0", Description = "Initial demo data seeded" });
        await db.SaveChangesAsync();

        // The demo data above assigns codes directly (CUST-2026-00001, ...) rather than
        // through CodeGeneratorService, so advance each backing sequence past the number of
        // rows just seeded — otherwise the first record created through the API after
        // seeding would collide with a seeded code and fail on the unique index.
        await AdvanceSequenceAsync(db, "customer_code_seq", customers.Count);
        await AdvanceSequenceAsync(db, "supplier_code_seq", suppliers.Count);
        await AdvanceSequenceAsync(db, "purchase_number_seq", purchaseNo - 1);
        await AdvanceSequenceAsync(db, "order_number_seq", orderNo - 1);
        await AdvanceSequenceAsync(db, "invoice_number_seq", invoiceNo - 1);
        await AdvanceSequenceAsync(db, "payment_number_seq", paymentNo - 1);
        await AdvanceSequenceAsync(db, "employee_code_seq", employees.Length);
        await AdvanceSequenceAsync(db, "processing_batch_number_seq", processingBatchNo - 1);
    }

    private static Task AdvanceSequenceAsync(ApplicationDbContext db, string sequenceName, int seededCount)
    {
        // setval's 2-arg form requires a value >= the sequence's minvalue (1), so when
        // nothing of this type was seeded, mark it "not yet called" at 1 instead — the
        // next nextval() then correctly still returns 1, matching a fresh sequence.
        var safeCount = Math.Max(seededCount, 1);
        var isCalled = seededCount > 0;
        return db.Database.ExecuteSqlAsync($"SELECT setval({sequenceName}, {safeCount}, {isCalled})");
    }
}
