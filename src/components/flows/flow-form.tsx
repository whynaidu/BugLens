"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createFlowSchema, updateFlowSchema } from "@/lib/validations/flow";

type CreateFlowInput = z.infer<typeof createFlowSchema>;
type UpdateFlowInput = z.infer<typeof updateFlowSchema>;

interface FlowFormProps {
  mode: "create" | "edit";
  projectId: string;
  defaultValues?: {
    id?: string;
    name?: string;
    description?: string | null;
  };
  onSubmit: (data: CreateFlowInput | UpdateFlowInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function FlowForm({
  mode,
  projectId,
  defaultValues,
  onSubmit,
  onCancel,
  isLoading,
}: FlowFormProps) {
  const schema = mode === "create" ? createFlowSchema : updateFlowSchema;

  const form = useForm<CreateFlowInput | UpdateFlowInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      projectId,
      ...(mode === "edit" && defaultValues?.id ? { flowId: defaultValues.id } : {}),
      name: defaultValues?.name ?? "",
      description: defaultValues?.description ?? "",
    },
  });

  const handleSubmit = async (data: CreateFlowInput | UpdateFlowInput) => {
    await onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Login Flow, Checkout Process"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe the user flow..."
                  className="resize-none"
                  rows={3}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading
              ? mode === "create"
                ? "Creating..."
                : "Saving..."
              : mode === "create"
              ? "Create Flow"
              : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
