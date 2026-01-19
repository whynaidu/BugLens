"use client";

import { X, Search } from "lucide-react";
import { useQueryState, parseAsArrayOf, parseAsString } from "nuqs";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { BugStatus, BugSeverity, BugPriority } from "@/lib/validations/bug";
import { ALL_STATUSES, getStatusLabel } from "./status-badge";
import { ALL_SEVERITIES, getSeverityLabel } from "./severity-badge";
import { ALL_PRIORITIES, getPriorityLabel } from "./priority-badge";

interface Member {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface BugFiltersProps {
  members?: Member[];
  className?: string;
}

export function BugFilters({ members = [], className }: BugFiltersProps) {
  // URL state for filters
  const [search, setSearch] = useQueryState("search", parseAsString.withDefault(""));
  const [status, setStatus] = useQueryState("status", parseAsArrayOf(parseAsString).withDefault([]));
  const [severity, setSeverity] = useQueryState("severity", parseAsArrayOf(parseAsString).withDefault([]));
  const [priority, setPriority] = useQueryState("priority", parseAsArrayOf(parseAsString).withDefault([]));
  const [assigneeId, setAssigneeId] = useQueryState("assignee", parseAsString);

  const hasFilters = search || status.length > 0 || severity.length > 0 || priority.length > 0 || assigneeId;

  const clearFilters = () => {
    setSearch("");
    setStatus([]);
    setSeverity([]);
    setPriority([]);
    setAssigneeId(null);
  };

  const toggleArrayFilter = (
    value: string,
    currentValues: string[],
    setter: (values: string[] | null) => void
  ) => {
    if (currentValues.includes(value)) {
      const newValues = currentValues.filter((v) => v !== value);
      setter(newValues.length > 0 ? newValues : null);
    } else {
      setter([...currentValues, value]);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search bugs..."
          value={search}
          onChange={(e) => setSearch(e.target.value || null)}
          className="pl-9"
        />
        {search && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0"
            onClick={() => setSearch(null)}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        {/* Status Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              Status
              {status.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1">
                  {status.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-3" align="start">
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-2">
                {ALL_STATUSES.map((s) => (
                  <div key={s} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${s}`}
                      checked={status.includes(s)}
                      onCheckedChange={() => toggleArrayFilter(s, status, setStatus)}
                    />
                    <Label
                      htmlFor={`status-${s}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {getStatusLabel(s as BugStatus)}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {/* Severity Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              Severity
              {severity.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1">
                  {severity.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-3" align="start">
            <div className="space-y-2">
              {ALL_SEVERITIES.map((s) => (
                <div key={s} className="flex items-center space-x-2">
                  <Checkbox
                    id={`severity-${s}`}
                    checked={severity.includes(s)}
                    onCheckedChange={() => toggleArrayFilter(s, severity, setSeverity)}
                  />
                  <Label
                    htmlFor={`severity-${s}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {getSeverityLabel(s as BugSeverity)}
                  </Label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Priority Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              Priority
              {priority.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1">
                  {priority.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-3" align="start">
            <div className="space-y-2">
              {ALL_PRIORITIES.map((p) => (
                <div key={p} className="flex items-center space-x-2">
                  <Checkbox
                    id={`priority-${p}`}
                    checked={priority.includes(p)}
                    onCheckedChange={() => toggleArrayFilter(p, priority, setPriority)}
                  />
                  <Label
                    htmlFor={`priority-${p}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {getPriorityLabel(p as BugPriority)}
                  </Label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Assignee Filter */}
        {members.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                Assignee
                {assigneeId && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1">
                    1
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-3" align="start">
              <ScrollArea className="max-h-[250px]">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="assignee-unassigned"
                      checked={assigneeId === "unassigned"}
                      onCheckedChange={(checked) =>
                        setAssigneeId(checked ? "unassigned" : null)
                      }
                    />
                    <Label
                      htmlFor="assignee-unassigned"
                      className="text-sm font-normal cursor-pointer text-muted-foreground"
                    >
                      Unassigned
                    </Label>
                  </div>
                  <Separator className="my-2" />
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`assignee-${member.id}`}
                        checked={assigneeId === member.id}
                        onCheckedChange={(checked) =>
                          setAssigneeId(checked ? member.id : null)
                        }
                      />
                      <Label
                        htmlFor={`assignee-${member.id}`}
                        className="text-sm font-normal cursor-pointer flex items-center gap-2"
                      >
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={member.image ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {member.name?.charAt(0) ?? member.email?.charAt(0) ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{member.name ?? member.email}</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        )}

        {/* Clear Filters */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground"
            onClick={clearFilters}
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Active Filter Pills */}
      {hasFilters && (
        <div className="flex flex-wrap gap-1">
          {status.map((s) => (
            <Badge
              key={`status-pill-${s}`}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => toggleArrayFilter(s, status, setStatus)}
            >
              Status: {getStatusLabel(s as BugStatus)}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          ))}
          {severity.map((s) => (
            <Badge
              key={`severity-pill-${s}`}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => toggleArrayFilter(s, severity, setSeverity)}
            >
              Severity: {getSeverityLabel(s as BugSeverity)}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          ))}
          {priority.map((p) => (
            <Badge
              key={`priority-pill-${p}`}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => toggleArrayFilter(p, priority, setPriority)}
            >
              Priority: {getPriorityLabel(p as BugPriority)}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          ))}
          {assigneeId && (
            <Badge
              variant="secondary"
              className="cursor-pointer"
              onClick={() => setAssigneeId(null)}
            >
              Assignee: {assigneeId === "unassigned"
                ? "Unassigned"
                : members.find((m) => m.id === assigneeId)?.name ?? "Selected"}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

// Export hook for using filters in other components
export function useBugFilters() {
  const [search] = useQueryState("search", parseAsString.withDefault(""));
  const [status] = useQueryState("status", parseAsArrayOf(parseAsString).withDefault([]));
  const [severity] = useQueryState("severity", parseAsArrayOf(parseAsString).withDefault([]));
  const [priority] = useQueryState("priority", parseAsArrayOf(parseAsString).withDefault([]));
  const [assigneeId] = useQueryState("assignee", parseAsString);

  return {
    search,
    status: status as BugStatus[],
    severity: severity as BugSeverity[],
    priority: priority as BugPriority[],
    assigneeId: assigneeId === "unassigned" ? null : assigneeId,
  };
}
