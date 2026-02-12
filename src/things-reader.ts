import { runJXA } from "./things-bridge";
import { ThingsTask, ThingsStatus, ThingsItemType, ThingsStart } from "./types";

export class ThingsNotRunningError extends Error {
    constructor() {
        super("Things 3 is not running");
        this.name = "ThingsNotRunningError";
    }
}

const READ_ALL_TASKS_JXA = `(function() {
    var app = Application("Things3");
    var todos = app.toDos;
    var count = todos.length;
    if (count === 0) return "[]";

    var ids = todos.id();
    var names = todos.name();
    var statuses = todos.status();
    var notesList = todos.notes();
    var tagNamesList = todos.tagNames();
    var activationDates = todos.activationDate();
    var dueDates = todos.dueDate();
    var completionDates = todos.completionDate();
    var creationDates = todos.creationDate();
    var modificationDates = todos.modificationDate();

    var projMap = {};
    var projects = app.projects;
    for (var p = 0; p < projects.length; p++) {
        var pId = projects[p].id();
        var pName = projects[p].name();
        var tIds = projects[p].toDos.id();
        for (var t = 0; t < tIds.length; t++) {
            projMap[tIds[t]] = [pId, pName];
        }
    }

    var areaMap = {};
    var areas = app.areas;
    for (var a = 0; a < areas.length; a++) {
        var aId = areas[a].id();
        var aName = areas[a].name();
        var tIds = areas[a].toDos.id();
        for (var t = 0; t < tIds.length; t++) {
            areaMap[tIds[t]] = [aId, aName];
        }
    }

    var inboxIds = {};
    var inboxTodos = app.lists.byName("Inbox").toDos.id();
    for (var ii = 0; ii < inboxTodos.length; ii++) inboxIds[inboxTodos[ii]] = true;

    var somedayIds = {};
    var somedayTodos = app.lists.byName("Someday").toDos.id();
    for (var si = 0; si < somedayTodos.length; si++) somedayIds[somedayTodos[si]] = true;

    var todayIds = {};
    var todayTodos = app.lists.byName("Today").toDos.id();
    for (var ti = 0; ti < todayTodos.length; ti++) todayIds[todayTodos[ti]] = true;

    var result = [];
    for (var i = 0; i < count; i++) {
        var proj = projMap[ids[i]];
        var area = areaMap[ids[i]];
        var s = statuses[i];
        var status = s === "completed" ? 3 : s === "canceled" ? 2 : 0;
        var start = inboxIds[ids[i]] ? 0 : somedayIds[ids[i]] ? 2 : 1;
        var tags = tagNamesList[i] ? tagNamesList[i].split(", ").sort() : [];
        var ad = activationDates[i];
        var dd = dueDates[i];
        var cd = completionDates[i];
        var crd = creationDates[i];
        var md = modificationDates[i];

        result.push({
            uuid: ids[i],
            title: names[i],
            status: status,
            notes: notesList[i] || "",
            project: proj ? proj[0] : null,
            projectTitle: proj ? proj[1] : null,
            area: area ? area[0] : null,
            areaTitle: area ? area[1] : null,
            tags: tags,
            startDate: ad ? fmtDate(ad) : null,
            deadline: dd ? fmtDate(dd) : null,
            stopDate: cd ? Math.floor(cd.getTime() / 1000) : null,
            creationDate: crd ? Math.floor(crd.getTime() / 1000) : 0,
            modificationDate: md ? Math.floor(md.getTime() / 1000) : 0,
            start: start,
            inTodayList: !!todayIds[ids[i]]
        });
    }
    return JSON.stringify(result);

    function fmtDate(d) {
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1);
        if (m.length < 2) m = "0" + m;
        var day = String(d.getDate());
        if (day.length < 2) day = "0" + day;
        return y + "-" + m + "-" + day;
    }
})()`;

interface RawJXATask {
    uuid: string;
    title: string;
    status: number;
    notes: string;
    project: string | null;
    projectTitle: string | null;
    area: string | null;
    areaTitle: string | null;
    tags: string[];
    startDate: string | null;
    deadline: string | null;
    stopDate: number | null;
    creationDate: number;
    modificationDate: number;
    start: number;
    inTodayList: boolean;
}

export function rawToTask(raw: RawJXATask): ThingsTask {
    return {
        uuid: raw.uuid,
        title: raw.title,
        status: raw.status as ThingsStatus,
        type: ThingsItemType.Todo,
        notes: raw.notes,
        project: raw.project,
        projectTitle: raw.projectTitle,
        area: raw.area,
        areaTitle: raw.areaTitle,
        tags: raw.tags,
        startDate: raw.startDate,
        deadline: raw.deadline,
        stopDate: raw.stopDate,
        creationDate: raw.creationDate,
        userModificationDate: raw.modificationDate,
        start: raw.start as ThingsStart,
        inTodayList: raw.inTodayList,
        trashed: false,
    };
}

export async function readAllTasks(): Promise<ThingsTask[]> {
    const result = await runJXA(READ_ALL_TASKS_JXA);
    if (result.code !== 0) {
        if (result.stderr.includes("not running") || result.stderr.includes("isn't running")) {
            throw new ThingsNotRunningError();
        }
        throw new Error(`JXA error: ${result.stderr}`);
    }

    const raw: RawJXATask[] = JSON.parse(result.stdout);
    return raw.map(rawToTask);
}
