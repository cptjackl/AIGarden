import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
  CreateWorldInputSchema,
  UpdateWorldInputSchema,
  WorldSchema,
  type CreateWorldInput,
  type UpdateWorldInput,
} from "@loregarden/shared";
import { request } from "../api";

const WORLDS_KEY = ["worlds"] as const;

export function useWorlds() {
  return useQuery({
    queryKey: WORLDS_KEY,
    queryFn: () => request(WorldSchema.array(), "/api/worlds"),
  });
}

export function useWorld(id: string) {
  return useQuery({
    queryKey: [...WORLDS_KEY, id],
    queryFn: () => request(WorldSchema, `/api/worlds/${id}`),
  });
}

export function useCreateWorld() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (input: CreateWorldInput) =>
      request(WorldSchema, "/api/worlds", {
        method: "POST",
        body: CreateWorldInputSchema.parse(input),
      }),
    onSuccess: (world) => {
      queryClient.invalidateQueries({ queryKey: WORLDS_KEY });
      navigate(`/worlds/${world.id}`);
    },
  });
}

export function useUpdateWorld(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateWorldInput) =>
      request(WorldSchema, `/api/worlds/${id}`, {
        method: "PATCH",
        body: UpdateWorldInputSchema.parse(input),
      }),
    onSuccess: (world) => {
      queryClient.setQueryData([...WORLDS_KEY, id], world);
      queryClient.invalidateQueries({ queryKey: WORLDS_KEY });
    },
  });
}
