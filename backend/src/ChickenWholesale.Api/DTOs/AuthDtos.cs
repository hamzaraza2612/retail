using System.ComponentModel.DataAnnotations;
using ChickenWholesale.Api.Models;

namespace ChickenWholesale.Api.DTOs;

public record LoginRequest(
    [Required] string Username,
    [Required] string Password
);

public record LoginResponse(
    string Token,
    int UserId,
    string Username,
    string FullName,
    string Email,
    UserRole Role
);

public record UserDto(
    int Id,
    string Username,
    string Email,
    string FullName,
    UserRole Role,
    string? Phone,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? LastLoginAt,
    int? EmployeeId,
    string? EmployeeName
);

public record CreateUserRequest(
    [Required] string Username,
    [Required, EmailAddress] string Email,
    [Required, MinLength(8)] string Password,
    [Required] string FullName,
    [Required] UserRole Role,
    string? Phone,
    int? EmployeeId
);

public record UpdateUserRequest(
    [Required] string FullName,
    [Required] UserRole Role,
    string? Phone,
    bool IsActive,
    int? EmployeeId
);

public record ChangePasswordRequest(
    [Required, MinLength(8)] string NewPassword
);
