import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import * as api from '../api/client';

export function useSession(sessionId: string | null) {
  const queryClient = useQueryClient();

  const {
    data: session,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => api.getSession(sessionId!),
    enabled: !!sessionId,
    refetchInterval: false,
  });

  const invalidateSession = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
  }, [queryClient, sessionId]);

  const createSessionMutation = useMutation({
    mutationFn: (name?: string) => api.createSession(name),
  });

  const joinSessionMutation = useMutation({
    mutationFn: ({ name }: { name: string }) =>
      api.joinSession(sessionId!, name),
    onSuccess: () => invalidateSession(),
  });

  const advanceSessionMutation = useMutation({
    mutationFn: (participantId: string) => api.advanceSession(sessionId!, participantId),
    onSuccess: () => invalidateSession(),
  });

  const setLocationMutation = useMutation({
    mutationFn: ({ zip, city }: { zip?: string; city?: string }) =>
      api.setSessionLocation(sessionId!, zip, city),
    onSuccess: () => invalidateSession(),
  });

  const addDatesMutation = useMutation({
    mutationFn: (dates: string[]) => api.addDates(sessionId!, dates),
    onSuccess: () => invalidateSession(),
  });

  const voteForDateMutation = useMutation({
    mutationFn: ({ dateId, participantId }: { dateId: string; participantId: string }) =>
      api.voteForDate(sessionId!, dateId, participantId),
    onSuccess: () => invalidateSession(),
  });

  const removeVoteForDateMutation = useMutation({
    mutationFn: ({ dateId, participantId }: { dateId: string; participantId: string }) =>
      api.removeVoteForDate(sessionId!, dateId, participantId),
    onSuccess: () => invalidateSession(),
  });

  const addMovieMutation = useMutation({
    mutationFn: (movie: {
      tmdbId: number;
      title: string;
      posterPath: string | null;
      overview: string;
      releaseDate: string;
      voteAverage: number;
    }) => api.addMovie(sessionId!, movie),
    onSuccess: () => invalidateSession(),
  });

  const voteForMovieMutation = useMutation({
    mutationFn: ({ movieId, participantId }: { movieId: string; participantId: string }) =>
      api.voteForMovie(sessionId!, movieId, participantId),
    onSuccess: () => invalidateSession(),
  });

  const removeVoteForMovieMutation = useMutation({
    mutationFn: ({ movieId, participantId }: { movieId: string; participantId: string }) =>
      api.removeVoteForMovie(sessionId!, movieId, participantId),
    onSuccess: () => invalidateSession(),
  });

  return {
    session,
    isLoading,
    error,
    refetch,
    invalidateSession,
    createSession: createSessionMutation.mutateAsync,
    joinSession: joinSessionMutation.mutateAsync,
    advanceSession: advanceSessionMutation.mutateAsync,
    setLocation: setLocationMutation.mutateAsync,
    addDates: addDatesMutation.mutateAsync,
    voteForDate: voteForDateMutation.mutateAsync,
    removeVoteForDate: removeVoteForDateMutation.mutateAsync,
    addMovie: addMovieMutation.mutateAsync,
    voteForMovie: voteForMovieMutation.mutateAsync,
    removeVoteForMovie: removeVoteForMovieMutation.mutateAsync,
  };
}
