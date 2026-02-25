
export const dateTimeShort = (d: Date) =>
  dateTimeShortFmt.format(d).replace(',', '');

export const now = () => dateTimeShort(new Date());

export const dateTimeShortFmt = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hourCycle: 'h23' // Use 24-hour format starting at 00:00:00
});  