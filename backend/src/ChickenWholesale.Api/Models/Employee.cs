namespace ChickenWholesale.Api.Models;

public class Employee
{
    public int Id { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? CNIC { get; set; }
    public string Role { get; set; } = string.Empty;
    public string? Department { get; set; }
    public DateTime JoiningDate { get; set; }
    public decimal Salary { get; set; }
    public EmployeeStatus Status { get; set; } = EmployeeStatus.Active;
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Delivery> Deliveries { get; set; } = new List<Delivery>();
}
