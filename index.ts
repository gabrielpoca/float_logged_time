import Ask from "https://deno.land/x/ask/mod.ts";
import {
  eachDayOfInterval,
  endOfWeek,
  format,
  isWeekend,
  startOfWeek,
} from "https://deno.land/x/date_fns/index.js";
import { assert } from "https://deno.land/std@0.61.0/_util/assert.ts";

interface FloatLoggedTime {
  logged_time_id: string;
  hours: number;
  date: string;
}

const API_ROOT = "https://api.float.com/v3";
const peopleId = Deno.env.get("FLOAT_PEOPLE_ID");
const projectId = Deno.env.get("FLOAT_PROJECT_ID");

const ask = new Ask();
const currentDate = new Date();

const headers = {
  Authorization: `Bearer ${Deno.env.get("FLOAT_ACCESS_KEY")}`,
  "Content-type": "application/json",
};

const daysOfTheWeek = eachDayOfInterval(
  {
    start: startOfWeek(currentDate, { weekStartsOn: 1 }),
    end: endOfWeek(currentDate, { weekStartsOn: 1 }),
  },
  {}
).filter((date) => !isWeekend(date));

const formatDate = (date: Date) => {
  return format(date, "yyyy-MM-dd", {});
};

const confirmations = await ask.prompt(
  daysOfTheWeek.map((date) => ({
    name: formatDate(date),
    type: "confirm",
    message: format(date, "EEE, dd/MM/yy", {}),
  }))
);

const allLoggedTimesResponse = await fetch(
  API_ROOT +
    `/logged-time?start_date=${formatDate(
      daysOfTheWeek[0]
    )}&end_date=${formatDate(
      daysOfTheWeek[daysOfTheWeek.length - 1]
    )}&people_id=${peopleId}&project_id=${projectId}`,
  {
    headers,
  }
);

const currentLoggedTimes = (await allLoggedTimesResponse.json())
  .filter(({ hours }: FloatLoggedTime) => hours > 0)
  .reduce((acc: { [date: string]: string }, logged_time: FloatLoggedTime) => {
    acc[logged_time.date] = logged_time.logged_time_id;
    return acc;
  }, {});

Object.keys(confirmations).map(async (date) => {
  if (!confirmations[date] && currentLoggedTimes[date]) {
    return deletedLoggedTime(currentLoggedTimes[date]);
  } else if (confirmations[date] && !currentLoggedTimes[date]) {
    return createLoggedTime(date);
  }
});

async function createLoggedTime(date: string) {
  const response = await fetch(API_ROOT + "/logged-time", {
    method: "POST",
    body: JSON.stringify({
      date,
      billable: 1,
      hours: 8,
      people_id: peopleId,
      project_id: projectId,
    }),
    headers,
  });

  assert(response.status === 200, `Failed to log ${date}`);
}

async function deletedLoggedTime(id: string) {
  const response = await fetch(API_ROOT + `/logged-time/${id}`, {
    method: "DELETE",
    headers,
  });

  assert(response.status === 200, `Failed to log ${currentDate}`);
}
