using System.ComponentModel.DataAnnotations;
using ChickenWholesale.Api.Models;

namespace ChickenWholesale.Api.DTOs;

public record EmployeeDto(
    int Id, string EmployeeCode, string Name, string Phone, string? CNIC, string Role,
    string? Department, DateTime JoiningDate, decimal Salary, EmployeeStatus Status, string? Notes
);

public record CreateEmployeeRequest(
    [Required] string Name,
    [Required] string Phone,
    string? CNIC,
    [Required] string Role,
    string? Department,
    DateTime? JoiningDate,
    [Range(0, double.MaxValue)] decimal Salary,
    string? Notes
);

public record UpdateEmployeeRequest(
    [Required] string Name,
    [Required] string Phone,
    string? CNIC,
    [Required] string Role,
    string? Department,
    [Range(0, double.MaxValue)] decimal Salary,
    EmployeeStatus Status,
    string? Notes
);
