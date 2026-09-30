using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ChickenWholesale.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddProcessingAndProductType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "processing_batch_number_seq");

            // Existing products predate this classification and were already being
            // purchased and sold directly, so they default to FinishedProduct — see
            // Models/Enums.cs ProductType doc comment and BUSINESS_WORKFLOW.md. Postgres
            // applies a column DEFAULT to existing rows on ADD COLUMN ... NOT NULL, so this
            // single statement both backfills current data and sets the default for future
            // inserts that don't specify it.
            migrationBuilder.AddColumn<string>(
                name: "ProductType",
                table: "Products",
                type: "text",
                nullable: false,
                defaultValue: "FinishedProduct");

            migrationBuilder.AddColumn<decimal>(
                name: "UnitCost",
                table: "InventoryTransactions",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ProcessingBatches",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    BatchNumber = table.Column<string>(type: "text", nullable: false),
                    ProcessingDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    WasteQuantity = table.Column<decimal>(type: "numeric(18,3)", nullable: false),
                    WasteUnit = table.Column<string>(type: "text", nullable: false),
                    WasteReason = table.Column<string>(type: "text", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedByUserId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProcessingBatches", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ProcessingInputs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProcessingBatchId = table.Column<int>(type: "integer", nullable: false),
                    ProductId = table.Column<int>(type: "integer", nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(18,3)", nullable: false),
                    Unit = table.Column<string>(type: "text", nullable: false),
                    UnitCost = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    TotalCost = table.Column<decimal>(type: "numeric(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProcessingInputs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProcessingInputs_ProcessingBatches_ProcessingBatchId",
                        column: x => x.ProcessingBatchId,
                        principalTable: "ProcessingBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProcessingInputs_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ProcessingOutputs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProcessingBatchId = table.Column<int>(type: "integer", nullable: false),
                    ProductId = table.Column<int>(type: "integer", nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(18,3)", nullable: false),
                    Unit = table.Column<string>(type: "text", nullable: false),
                    UnitCost = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    AllocatedCost = table.Column<decimal>(type: "numeric(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProcessingOutputs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProcessingOutputs_ProcessingBatches_ProcessingBatchId",
                        column: x => x.ProcessingBatchId,
                        principalTable: "ProcessingBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProcessingOutputs_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProcessingBatches_BatchNumber",
                table: "ProcessingBatches",
                column: "BatchNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProcessingBatches_ProcessingDate",
                table: "ProcessingBatches",
                column: "ProcessingDate");

            migrationBuilder.CreateIndex(
                name: "IX_ProcessingInputs_ProcessingBatchId",
                table: "ProcessingInputs",
                column: "ProcessingBatchId");

            migrationBuilder.CreateIndex(
                name: "IX_ProcessingInputs_ProductId",
                table: "ProcessingInputs",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_ProcessingOutputs_ProcessingBatchId",
                table: "ProcessingOutputs",
                column: "ProcessingBatchId");

            migrationBuilder.CreateIndex(
                name: "IX_ProcessingOutputs_ProductId",
                table: "ProcessingOutputs",
                column: "ProductId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProcessingInputs");

            migrationBuilder.DropTable(
                name: "ProcessingOutputs");

            migrationBuilder.DropTable(
                name: "ProcessingBatches");

            migrationBuilder.DropColumn(
                name: "ProductType",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "UnitCost",
                table: "InventoryTransactions");

            migrationBuilder.DropSequence(
                name: "processing_batch_number_seq");
        }
    }
}
