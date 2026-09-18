using System.Globalization;
using System.Text;

namespace ChickenWholesale.Api.Services;

public static class CsvExportService
{
    public static byte[] ToCsv<T>(IEnumerable<T> items)
    {
        var props = typeof(T).GetProperties();
        var sb = new StringBuilder();
        sb.AppendLine(string.Join(",", props.Select(p => Escape(p.Name))));
        foreach (var item in items)
        {
            var values = props.Select(p =>
            {
                var val = p.GetValue(item);
                var str = val switch
                {
                    null => "",
                    DateTime dt => dt.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture),
                    decimal d => d.ToString("F2", CultureInfo.InvariantCulture),
                    _ => val.ToString()
                };
                return Escape(str ?? "");
            });
            sb.AppendLine(string.Join(",", values));
        }
        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    private static string Escape(string value)
    {
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n'))
            return "\"" + value.Replace("\"", "\"\"") + "\"";
        return value;
    }
}
