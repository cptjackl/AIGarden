import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { z } from "zod";
import {
  LoginInputSchema,
  RegisterInputSchema,
  UserSchema,
  type LoginInput,
  type RegisterInput,
  type User,
} from "@loregarden/shared";
import { ApiError, request } from "../api";

const ME_KEY = ["me"] as const;

/** The signed-in user, or null when signed out. */
export function useCurrentUser() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async (): Promise<User | null> => {
      try {
        return await request(UserSchema, "/api/auth/me");
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (input: LoginInput) =>
      request(UserSchema, "/api/auth/login", {
        method: "POST",
        body: LoginInputSchema.parse(input),
      }),
    onSuccess: (user) => {
      queryClient.setQueryData(ME_KEY, user);
      navigate("/", { replace: true });
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      request(UserSchema, "/api/auth/register", {
        method: "POST",
        body: RegisterInputSchema.parse(input),
      }),
    onSuccess: (user) => {
      queryClient.setQueryData(ME_KEY, user);
      navigate("/", { replace: true });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => request(z.undefined(), "/api/auth/logout", { method: "POST" }),
    onSettled: () => {
      // Drop cached per-user data so the next account on this browser never sees it.
      queryClient.removeQueries({ queryKey: ["worlds"] });
      queryClient.setQueryData(ME_KEY, null);
      navigate("/login", { replace: true });
    },
  });
}
