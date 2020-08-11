const summoner = {
    byName: (region, name) => `https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-name/${name}`,
}
const match = {
    matchList: (region, accountId) => `https://${region}.api.riotgames.com/lol/match/v4/matchlists/by-account/${accountId}`,
    timeline: (region, matchId) => `https://${region}.api.riotgames.com/lol/match/v4/timelines/by-match/${matchId}`
}

module.exports = {
    match,
    summoner
}