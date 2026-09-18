using System.Security.Claims;

namespace ChickenWholesale.Api.Services;

public class CurrentUserService
{
    private readonly IHttpContextAccessor _accessor;

    public CurrentUserService(IHttpContextAccessor accessor)
    {
        _accessor = accessor;
    }

    public int UserId
    {
        get
        {
            var idClaim = _accessor.HttpContext?.User?.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.TryParse(idClaim, out var id) ? id : 0;
        }
    }

    public string UserName => _accessor.HttpContext?.User?.FindFirstValue(ClaimTypes.Name) ?? "system";

    public string Role => _accessor.HttpContext?.User?.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
}
