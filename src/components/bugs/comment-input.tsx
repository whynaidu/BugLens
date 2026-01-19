"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Eye, Edit3, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Member {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface CommentInputProps {
  onSubmit: (content: string) => Promise<void>;
  members?: Member[];
  placeholder?: string;
  initialValue?: string;
  isEditing?: boolean;
  onCancel?: () => void;
  className?: string;
}

export function CommentInput({
  onSubmit,
  members = [],
  placeholder = "Write a comment... Use @name to mention someone.",
  initialValue = "",
  isEditing = false,
  onCancel,
  className,
}: CommentInputProps) {
  const [content, setContent] = useState(initialValue);
  const [isPreview, setIsPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Filter members based on mention query
  const filteredMembers = members.filter((member) => {
    const searchTerm = mentionQuery.toLowerCase();
    return (
      member.name?.toLowerCase().includes(searchTerm) ||
      member.email?.toLowerCase().includes(searchTerm)
    );
  });

  // Handle content change and detect @mentions
  const handleContentChange = useCallback((value: string) => {
    setContent(value);

    // Check for @mention pattern
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setShowMentions(true);

      // Calculate position for mention popup
      // This is a simplified approach - a more robust solution would measure text
      const lineHeight = 24;
      const lines = textBeforeCursor.split("\n");
      const currentLine = lines.length;
      setMentionPosition({
        top: currentLine * lineHeight,
        left: (lines[lines.length - 1]?.length ?? 0) * 8,
      });
    } else {
      setShowMentions(false);
      setMentionQuery("");
    }
  }, []);

  // Insert mention into content
  const insertMention = useCallback(
    (member: Member) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = content.substring(0, cursorPos);
      const textAfterCursor = content.substring(cursorPos);

      // Find the @ symbol position
      const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
      if (!mentionMatch) return;

      const mentionStart = textBeforeCursor.lastIndexOf("@");
      const mentionName = member.name || member.email || "unknown";

      const newContent =
        textBeforeCursor.substring(0, mentionStart) +
        `@${mentionName} ` +
        textAfterCursor;

      setContent(newContent);
      setShowMentions(false);
      setMentionQuery("");

      // Focus back on textarea
      setTimeout(() => {
        textarea.focus();
        const newPos = mentionStart + mentionName.length + 2;
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    },
    [content]
  );

  // Handle keyboard navigation in mentions
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (showMentions && filteredMembers.length > 0) {
        if (e.key === "Escape") {
          setShowMentions(false);
          e.preventDefault();
        } else if (e.key === "Tab" || e.key === "Enter") {
          insertMention(filteredMembers[0]);
          e.preventDefault();
        }
      }
    },
    [showMentions, filteredMembers, insertMention]
  );

  // Handle form submit
  const handleSubmit = async () => {
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(content.trim());
      if (!isEditing) {
        setContent("");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset on initial value change (for edit mode)
  useEffect(() => {
    setContent(initialValue);
  }, [initialValue]);

  // Simple markdown rendering for preview
  const renderMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`(.*?)`/g, "<code>$1</code>")
      .replace(/@(\w+)/g, '<span class="text-primary font-medium">@$1</span>')
      .replace(/\n/g, "<br />");
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <Button
            type="button"
            variant={isPreview ? "ghost" : "secondary"}
            size="sm"
            onClick={() => setIsPreview(false)}
          >
            <Edit3 className="h-4 w-4 mr-1" />
            Write
          </Button>
          <Button
            type="button"
            variant={isPreview ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setIsPreview(true)}
            disabled={!content.trim()}
          >
            <Eye className="h-4 w-4 mr-1" />
            Preview
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">
          Supports **bold**, *italic*, `code`
        </span>
      </div>

      {/* Content area */}
      <div className="relative">
        {isPreview ? (
          <div
            className="min-h-[100px] p-3 rounded-md border bg-muted/30 prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        ) : (
          <>
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="min-h-[100px] resize-none"
              disabled={isSubmitting}
            />

            {/* Mentions dropdown */}
            {showMentions && filteredMembers.length > 0 && (
              <Popover open={showMentions} onOpenChange={setShowMentions}>
                <PopoverTrigger asChild>
                  <span
                    className="absolute invisible"
                    style={{
                      top: mentionPosition.top,
                      left: mentionPosition.left,
                    }}
                  />
                </PopoverTrigger>
                <PopoverContent
                  className="w-[250px] p-1"
                  align="start"
                  side="bottom"
                  sideOffset={5}
                >
                  <div className="space-y-1">
                    {filteredMembers.slice(0, 5).map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent text-left"
                        onClick={() => insertMention(member)}
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={member.image ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {member.name?.charAt(0) ??
                              member.email?.charAt(0) ??
                              "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {member.name ?? member.email}
                          </p>
                          {member.name && member.email && (
                            <p className="text-xs text-muted-foreground truncate">
                              {member.email}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        {(isEditing || onCancel) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={!content.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isEditing ? "Saving..." : "Posting..."}
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              {isEditing ? "Save" : "Comment"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
