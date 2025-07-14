class Utils {
  static getUserName(msg) {
    return msg.from.first_name || "사용자";
  }

  static parseTime(timeStr) {
    if (!timeStr.includes(":")) return null;
    const [hours, minutes] = timeStr.split(":").map(Number);
    if (hours > 23 || minutes > 59) return null;
    return { hours, minutes };
  }

  static timeToMinutes({ hours, minutes }) {
    return hours * 60 + minutes;
  }

  static formatTimeString({ hours, minutes }) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }
}
module.exports = Utils;
