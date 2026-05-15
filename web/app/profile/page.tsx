import { getServerSupabase } from "@/lib/supabase/server";
import type { Game, MatchRoundDemo, Profile } from "@/lib/types/db";
import { DeepCuts } from "@/components/stats/DeepCuts";
import { GuestPromptCard } from "@/components/profile/GuestPromptCard";
import { ProfileHero } from "@/components/profile/ProfileHero";
import { ProfileMascotPose } from "@/components/profile/ProfileMascotPose";
import { StatsTriptych } from "@/components/profile/StatsTriptych";
import {
  RecentRuns,
  type RecentMatchRow,
} from "@/components/profile/RecentRuns";

export const dynamic = "force-dynamic";

type ProfileBit = { username: string; country: string | null };
type MatchDemoRow = MatchRoundDemo & {
  player0: ProfileBit | null;
  player1: ProfileBit | null;
};

function summarizeMatches(
  rows: MatchDemoRow[],
  userId: string,
): RecentMatchRow[] {
  const byMatch = new Map<string, MatchDemoRow[]>();
  for (const row of rows) {
    const list = byMatch.get(row.match_id) ?? [];
    list.push(row);
    byMatch.set(row.match_id, list);
  }

  return Array.from(byMatch.values())
    .map((rounds) => {
      rounds.sort((a, b) => a.round_index - b.round_index);
      const first = rounds[0];
      const iAmPlayer0 = first.player0_id === userId;
      const opponent = iAmPlayer0 ? first.player1 : first.player0;
      const opponentIndex = iAmPlayer0 ? 1 : 0;
      const myIndex = iAmPlayer0 ? 0 : 1;
      let myRoundsWon = 0;
      let opponentRoundsWon = 0;
      for (const round of rounds) {
        if (round.winner_index === myIndex) myRoundsWon++;
        else if (round.winner_index === opponentIndex) opponentRoundsWon++;
      }
      const result: RecentMatchRow["result"] =
        myRoundsWon > opponentRoundsWon
          ? "won"
          : opponentRoundsWon > myRoundsWon
            ? "lost"
            : "draw";
      return {
        matchId: first.match_id,
        opponentName: opponent?.username ?? "opponent",
        opponentCountry: opponent?.country ?? null,
        playedAt: rounds.reduce(
          (latest, round) =>
            new Date(round.played_at).getTime() > new Date(latest).getTime()
              ? round.played_at
              : latest,
          first.played_at,
        ),
        myRoundsWon,
        opponentRoundsWon,
        result,
        rounds: rounds.map((round) => ({
          id: round.id,
          round_index: round.round_index,
          won: round.winner_index === myIndex,
          draw: round.winner_index === null,
        })),
      };
    })
    .sort(
      (a, b) =>
        new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime(),
    );
}

export default async function ProfilePage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <GuestPromptCard />;
  }

  const [profileRes, gamesRes, pvpRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("games")
      .select(
        "id, user_id, difficulty, seed, won, elapsed_ms, opens, clicks, flagged, post_loss_hint_count, boom_r, boom_c, played_at, actions",
      )
      .eq("user_id", user.id)
      .order("played_at", { ascending: false })
      .limit(200),
    supabase
      .from("match_round_demos")
      .select(
        [
          "id",
          "match_id",
          "round_index",
          "rows",
          "cols",
          "mines",
          "seed",
          "time_limit_ms",
          "pre_plant_r",
          "pre_plant_c",
          "winner_index",
          "player0_id",
          "player1_id",
          "player0_reason",
          "player0_elapsed_ms",
          "player0_opens",
          "player0_clicks",
          "player0_flagged",
          "player0_score",
          "player0_mistakes",
          "player0_actions",
          "player1_reason",
          "player1_elapsed_ms",
          "player1_opens",
          "player1_clicks",
          "player1_flagged",
          "player1_score",
          "player1_mistakes",
          "player1_actions",
          "played_at",
          "player0:profiles!match_round_demos_player0_id_fkey(username, country)",
          "player1:profiles!match_round_demos_player1_id_fkey(username, country)",
        ].join(", "),
      )
      .or(`player0_id.eq.${user.id},player1_id.eq.${user.id}`)
      .order("played_at", { ascending: false })
      .limit(80),
  ]);

  const profile = (profileRes.data as Profile | null) ?? null;
  const allGames = (gamesRes.data as Game[] | null) ?? [];
  const pvpRows = (pvpRes.data as unknown as MatchDemoRow[] | null) ?? [];
  const pvpMatches = summarizeMatches(pvpRows, user.id).slice(0, 10);
  const games = allGames.slice(0, 20);

  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 26,
        padding: "32px 28px 56px",
        maxWidth: 1080,
        width: "100%",
        margin: "0 auto",
      }}
    >
      <ProfileMascotPose
        pose="chipCount"
        caption="your table, your numbers"
      />
      <ProfileHero profile={profile} />
      <StatsTriptych profile={profile} />
      <DeepCuts games={allGames} />
      <RecentRuns matches={pvpMatches} games={games} />
    </main>
  );
}
