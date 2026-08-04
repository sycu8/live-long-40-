/** Short encouragement copy for weekly plan progress (Vietnamese). */

export function weekEncouragement(completed: number, total: number): string {
  if (total <= 0) {
    return "Khi có kế hoạch, mỗi việc nhỏ sẽ hiện ở đây.";
  }
  const ratio = completed / total;
  if (completed === 0) {
    return "Tuần này bắt đầu bằng một việc vừa sức — không cần hoàn hảo.";
  }
  if (ratio < 0.5) {
    return "Bạn đã mở đà rồi. Việc tiếp theo vẫn tính, dù chỉ 15 phút.";
  }
  if (ratio < 1) {
    return "Gần xong tuần này rồi. Giữ nhịp nhẹ — đó là cách bền.";
  }
  return "Bạn đã hoàn thành việc tuần này. Hãy nghỉ ngơi hoặc đọc một bài động viên.";
}

export function reflectionPrompt(): string {
  return "Một phút nhìn lại giúp bạn học cách điều chỉnh việc cho vừa sức hơn.";
}
