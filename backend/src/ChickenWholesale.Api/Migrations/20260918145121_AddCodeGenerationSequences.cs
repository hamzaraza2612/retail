using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChickenWholesale.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCodeGenerationSequences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "customer_code_seq");

            migrationBuilder.CreateSequence(
                name: "employee_code_seq");

            migrationBuilder.CreateSequence(
                name: "invoice_number_seq");

            migrationBuilder.CreateSequence(
                name: "order_number_seq");

            migrationBuilder.CreateSequence(
                name: "payment_number_seq");

            migrationBuilder.CreateSequence(
                name: "purchase_number_seq");

            migrationBuilder.CreateSequence(
                name: "supplier_code_seq");

            migrationBuilder.CreateSequence(
                name: "supplier_payment_number_seq");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropSequence(
                name: "customer_code_seq");

            migrationBuilder.DropSequence(
                name: "employee_code_seq");

            migrationBuilder.DropSequence(
                name: "invoice_number_seq");

            migrationBuilder.DropSequence(
                name: "order_number_seq");

            migrationBuilder.DropSequence(
                name: "payment_number_seq");

            migrationBuilder.DropSequence(
                name: "purchase_number_seq");

            migrationBuilder.DropSequence(
                name: "supplier_code_seq");

            migrationBuilder.DropSequence(
                name: "supplier_payment_number_seq");
        }
    }
}
