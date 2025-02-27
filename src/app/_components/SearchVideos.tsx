"use client";

import { useState } from "react";

import { api } from "~/trpc/react";

export function SearchVideos() {
  const [latestPost] = api.video.getLatest.useSuspenseQuery();

  const utils = api.useUtils();
  const [url, setUrl] = useState("");
  const createPost = api.video.create.useMutation({
    onSuccess: async () => {
      await utils.video.invalidate();
      setUrl("");
    },
  });

  return (
    <div className="w-full max-w-xs">
      {latestPost ? (
        <p className="truncate">Your most recent video: {latestPost.title}</p>
      ) : (
        <p>You have no posts yet.</p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createPost.mutate({ url });
        }}
        className="flex flex-col gap-2"
      >
        <input
          type="text"
          placeholder="Video URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full rounded-full px-4 py-2 text-black"
        />
        <button
          type="submit"
          className="rounded-full bg-white/10 px-10 py-3 font-semibold transition hover:bg-white/20"
          disabled={createPost.isPending}
        >
          {createPost.isPending ? "Submitting..." : "Submit"}
        </button>
      </form>
    </div>
  );
}
