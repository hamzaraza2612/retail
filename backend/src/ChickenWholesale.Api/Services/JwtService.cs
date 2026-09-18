using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ChickenWholesale.Api.Models;
using Microsoft.IdentityModel.Tokens;

namespace ChickenWholesale.Api.Services;

public class JwtService
{
    private readonly IConfiguration _config;

    public JwtService(IConfiguration config)
    {
        _config = config;
    }

    public string GenerateToken(User user)
    {
        var jwtSection = _config.GetSection("Jwt");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSection["Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, user.Role.ToString()),
            new("fullName", user.FullName),
            new("pwdTs", user.PasswordChangedAt.Ticks.ToString())
        };

        if (user.EmployeeId.HasValue)
            claims.Add(new Claim("employeeId", user.EmployeeId.Value.ToString()));

        var expiryHours = double.Parse(jwtSection["ExpiryHours"] ?? "12");
        var token = new JwtSecurityToken(
            issuer: jwtSection["Issuer"],
            audience: jwtSection["Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(expiryHours),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
