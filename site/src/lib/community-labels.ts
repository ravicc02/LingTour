const labels: Record<string, string> = {
  "Field Notes": "Travel Posts", "Food Map": "Food", "Hidden Stop": "Places", "Culture Desk": "Culture",
};
export function communityChannelLabel(channel: string): string {
  return labels[channel] ?? channel;
}
