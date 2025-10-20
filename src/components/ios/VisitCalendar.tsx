/**
 * iOS Calendar-style visit calendar
 * Shows visits in a month grid like iOS Calendar app
 */

interface Visit {
  id: string;
  eventtime: string;
  department: string;
  groupsize: number;
}

interface VisitCalendarProps {
  visits: Visit[];
}

export function VisitCalendar({ visits }: VisitCalendarProps) {
  // Group visits by date
  const visitsByDate = new Map<string, Visit[]>();
  visits.forEach(visit => {
    const dateStr = new Date(visit.eventtime).toLocaleDateString('sv-SE', {
      timeZone: 'Europe/Stockholm',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    if (!visitsByDate.has(dateStr)) {
      visitsByDate.set(dateStr, []);
    }
    visitsByDate.get(dateStr)!.push(visit);
  });

  // Generate last 4 weeks
  const weeks = [];
  const nowInSweden = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Stockholm' }));

  // Find most recent Sunday
  const mostRecentSunday = new Date(nowInSweden);
  const dayOfWeek = mostRecentSunday.getDay();
  const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  mostRecentSunday.setDate(mostRecentSunday.getDate() + daysToSunday);

  for (let weekOffset = 3; weekOffset >= 0; weekOffset--) {
    const weekDays = [];
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const date = new Date(mostRecentSunday);
      date.setDate(date.getDate() - (weekOffset * 7) - (6 - dayOffset));
      const dateKey = date.toLocaleDateString('sv-SE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const dayVisits = visitsByDate.get(dateKey) || [];
      weekDays.push({ date, dateKey, visits: dayVisits });
    }
    weeks.push(weekDays);
  }

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const getDayName = (dayIndex: number) => {
    const names = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];
    return names[dayIndex];
  };

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200 lg:max-w-3xl">
      {/* Header with day names - iOS Calendar style */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
          <div
            key={i}
            className="text-center py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide"
          >
            {getDayName(i)}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="divide-y divide-gray-200">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 divide-x divide-gray-200">
            {week.map((day, dayIndex) => {
              const hasVisits = day.visits.length > 0;
              const today = isToday(day.date);
              const gents = day.visits.filter(v =>
                v.department === 'GENTS' || v.department === 'Herrar'
              ).length;
              const ladies = day.visits.filter(v =>
                v.department === 'LADIES' || v.department === 'Damer'
              ).length;

              return (
                <div
                  key={dayIndex}
                  className={`
                    min-h-[60px] lg:min-h-[80px] p-2
                    ${hasVisits ? 'bg-blue-50/50' : 'bg-white'}
                    ${today ? 'bg-blue-100' : ''}
                    transition-colors
                  `}
                >
                  {/* Date number */}
                  <div className={`
                    text-sm font-medium mb-1
                    ${today ? 'text-blue-600 font-bold' : 'text-gray-900'}
                    ${hasVisits && !today ? 'text-blue-600' : ''}
                  `}>
                    {day.date.getDate()}
                  </div>

                  {/* Visit indicators */}
                  {hasVisits && (
                    <div className="space-y-1">
                      {/* Total visits */}
                      <div className="text-xs font-semibold text-blue-600">
                        {day.visits.length}
                      </div>

                      {/* Gender breakdown */}
                      <div className="flex gap-1 text-[10px] text-gray-500">
                        {gents > 0 && <span>♂️{gents}</span>}
                        {ladies > 0 && <span>♀️{ladies}</span>}
                      </div>

                      {/* Visit times (max 3) */}
                      <div className="space-y-0.5 mt-1">
                        {day.visits.slice(0, 3).map((visit, idx) => {
                          const utcTime = visit.eventtime.endsWith('Z') ? visit.eventtime : visit.eventtime + 'Z';
                          const time = new Date(utcTime).toLocaleTimeString('sv-SE', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Europe/Stockholm'
                          });
                          return (
                            <div
                              key={idx}
                              className="text-[10px] text-gray-500 truncate"
                            >
                              {time}
                            </div>
                          );
                        })}
                        {day.visits.length > 3 && (
                          <div className="text-[10px] text-gray-400">
                            +{day.visits.length - 3}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
