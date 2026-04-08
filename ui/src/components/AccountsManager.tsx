import { useState, useEffect } from "react"
import {
    Box,
    Button,
    Typography,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    TextField,
    DialogActions,
    CircularProgress,
    Alert,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Card,
    CardContent,
    Grid,
    Chip,
    Paper,
    alpha,
    useTheme
} from "@mui/material"
import { Add, Login, Refresh } from "@mui/icons-material"
import { SOCIAL_PLATFORMS } from "@threadline/constants/platforms.js"
import { getApiBase, scrapeAuto } from "../api"

const api = window.api

async function getSessions(): Promise<string[]> {
    if (api?.scraper?.getSessions) return api.scraper.getSessions()
    const base = await getApiBase()
    const r = await fetch(`${base}/api/sessions`)
    if (!r.ok) throw new Error(await r.text())
    return r.json()
}

async function scrape(options: { url: string; session: string; interactive: boolean }) {
    if (api?.scraper?.scrape) return api.scraper.scrape(options)
    const base = await getApiBase()
    const r = await fetch(`${base}/api/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
    })
    if (!r.ok) {
        const err = await r.json().catch(() => ({ error: r.statusText }))
        throw new Error((err as { error?: string }).error || "Scrape failed")
    }
    return r.json()
}


function hasSessionForPlatform(sessions: string[], platformId: string): boolean {
    return sessions.some(s => s.toLowerCase().includes(platformId))
}

export function AccountsManager() {
    const theme = useTheme()
    const [sessions, setSessions] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [openAdd, setOpenAdd] = useState(false)
    const [newSessionName, setNewSessionName] = useState("")
    const [loginUrl, setLoginUrl] = useState("")
    const [selectedPlatformId, setSelectedPlatformId] = useState("")
    const [isLoggingIn, setIsLoggingIn] = useState(false)

    const [testPlatformId, setTestPlatformId] = useState("instagram")
    const [testIdentifier, setTestIdentifier] = useState("")
    const [testType, setTestType] = useState<"profile" | "followers" | "following">("profile")
    const [testing, setTesting] = useState(false)
    const [testResult, setTestResult] = useState<null | {
        selectorUsed?: string
        selectorUpdated?: boolean
        extracted?: Array<{ text?: string }>
        error?: string
    }>(null)



    const loadSessions = async () => {
        setLoading(true)
        try {
            const list = await getSessions()
            setSessions(list)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadSessions()
    }, [])

    const openLoginForPlatform = (platformId: string) => {
        const p = SOCIAL_PLATFORMS.find(x => x.id === platformId)
        if (p) {
            setSelectedPlatformId(platformId)
            setLoginUrl(p.loginUrl)
            setNewSessionName(platformId + "-main")
            setOpenAdd(true)
        }
    }



    const handleLogin = async () => {
        if (!newSessionName.trim() || !loginUrl.trim()) return
        setIsLoggingIn(true)
        try {
            await scrape({
                url: loginUrl,
                session: newSessionName,
                interactive: true,
            })
            setOpenAdd(false)
            setNewSessionName("")
            setLoginUrl("")
            setSelectedPlatformId("")
            await loadSessions()
        } catch (e) {
            console.error("Login failed", e)
            alert("Login failed: " + (e instanceof Error ? e.message : String(e)))
        } finally {
            setIsLoggingIn(false)
        }
    }

    const handleTestAutoScrape = async () => {
        const id = testIdentifier.trim()
        if (!id) return
        setTesting(true)
        setTestResult(null)
        try {
            const data = (await scrapeAuto({
                platform: testPlatformId,
                identifier: id,
                type: testType
            })) as {
                selectorUsed?: string
                selectorUpdated?: boolean
                extracted?: Array<{ text?: string }>
            }
            setTestResult({
                selectorUsed: data.selectorUsed,
                selectorUpdated: data.selectorUpdated,
                extracted: Array.isArray(data.extracted) ? data.extracted : [],
            })
        } catch (e) {
            setTestResult({ error: e instanceof Error ? e.message : String(e) })
        } finally {
            setTesting(false)
        }
    }

    return (
        <Box sx={{ p: 3.5, maxWidth: 1080, mx: "auto" }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 1.5, gap: 1 }}>
                <Typography variant="h5" sx={{ flexGrow: 1, fontWeight: 700 }}>Accounts</Typography>
                <Button variant="outlined" startIcon={<Add />} onClick={() => setOpenAdd(true)} sx={{ borderRadius: 3 }}>
                    Add account
                </Button>
                <IconButton onClick={loadSessions} sx={{ ml: 0.5 }} aria-label="Refresh">
                    <Refresh />
                </IconButton>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Log in to social platforms to save your session. Each card uses the statically defined list of platforms.
            </Typography>

            <Paper
                variant="outlined"
                className="glass-panel"
                sx={{
                    p: 2,
                    mb: 3,
                    borderRadius: 4,
                    borderColor: alpha(theme.palette.common.white, 0.06),
                }}
            >
                <Typography sx={{ fontWeight: 800, mb: 1 }}>Test login session (self-healing scrape)</Typography>
                <Typography variant="body2" sx={{ color: alpha(theme.palette.text.primary, 0.6), mb: 2 }}>
                    Uses your saved session automatically (e.g. <code>instagram-main</code>) and repairs selectors if they break.
                </Typography>

                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>Platform</InputLabel>
                        <Select
                            value={testPlatformId}
                            label="Platform"
                            onChange={(e) => setTestPlatformId(String(e.target.value))}
                            sx={{ borderRadius: 2 }}
                        >
                            {SOCIAL_PLATFORMS.map(p => (
                                <MenuItem key={p.id} value={p.id}>
                                    {p.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <TextField
                        size="small"
                        label="Identifier"
                        placeholder="@username"
                        value={testIdentifier}
                        onChange={(e) => setTestIdentifier(e.target.value)}
                        sx={{ minWidth: 240, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                    />

                    <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel>Type</InputLabel>
                        <Select
                            value={testType}
                            label="Type"
                            onChange={(e) => setTestType(e.target.value as "profile" | "followers" | "following")}
                            sx={{ borderRadius: 2 }}
                        >
                            <MenuItem value="profile">Profile</MenuItem>
                            <MenuItem value="followers">Followers</MenuItem>
                            <MenuItem value="following">Following</MenuItem>
                        </Select>
                    </FormControl>

                    <Button
                        variant="contained"
                        onClick={handleTestAutoScrape}
                        disabled={testing || !testIdentifier.trim()}
                        sx={{ borderRadius: 2, fontWeight: 800 }}
                    >
                        {testing ? <CircularProgress size={18} color="inherit" /> : "Run auto scrape"}
                    </Button>
                </Box>

                {testResult?.error && (
                    <Alert severity="error" sx={{ mt: 2, borderRadius: 3 }}>
                        {testResult.error}
                    </Alert>
                )}

                {!testResult?.error && testResult && (
                    <Box sx={{ mt: 2 }}>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1 }}>
                            <Chip
                                size="small"
                                color={testResult.selectorUpdated ? "primary" : "default"}
                                label={testResult.selectorUpdated ? "Selector updated" : "Selector unchanged"}
                            />
                            {testResult.selectorUsed && (
                                <Chip size="small" variant="outlined" label={`Selector: ${testResult.selectorUsed}`} />
                            )}
                            <Chip size="small" variant="outlined" label={`Rows: ${testResult.extracted?.length ?? 0}`} />
                        </Box>
                        <Paper
                            variant="outlined"
                            className="custom-scrollbar"
                            sx={{
                                p: 1.5,
                                borderRadius: 3,
                                maxHeight: 240,
                                overflow: "auto",
                                bgcolor: alpha(theme.palette.background.paper, 0.55),
                            }}
                        >
                            {(testResult.extracted || []).slice(0, 120).map((r, idx) => (
                                <Typography key={idx} variant="body2" sx={{ mb: 0.5, whiteSpace: "pre-wrap" }}>
                                    {r.text || ""}
                                </Typography>
                            ))}
                            {(testResult.extracted?.length || 0) === 0 && (
                                <Typography variant="body2" color="text.secondary">
                                    No rows extracted.
                                </Typography>
                            )}
                        </Paper>
                    </Box>
                )}
            </Paper>


            {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>
            ) : (
                <Grid container spacing={2}>
                    {SOCIAL_PLATFORMS.map((platform) => {
                        const hasSession = hasSessionForPlatform(sessions, platform.id)
                        return (
                            <Grid item xs={12} sm={6} md={4} key={platform.id}>
                                <Card
                                    variant="outlined"
                                    className="glass-panel"
                                    sx={{
                                        height: "100%",
                                        display: "flex",
                                        flexDirection: "column",
                                        borderRadius: 4,
                                        borderColor: alpha(theme.palette.common.white, 0.06),
                                        transition: "transform 160ms cubic-bezier(0.4, 0, 0.2, 1)",
                                        "&:hover": { transform: "translateY(-4px)" },
                                    }}
                                >
                                    <CardContent sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                                        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
                                            <Box>
                                                <Typography fontWeight={800}>{platform.name}</Typography>
                                                <Typography variant="body2" sx={{ color: alpha(theme.palette.text.primary, 0.55) }}>
                                                    {hasSession ? "Session saved" : "Not logged in"}
                                                </Typography>
                                            </Box>
                                            <Box sx={{ opacity: 0.35, color: "primary.main" }}>
                                                <span className="material-symbols-outlined" style={{ fontVariationSettings: '"FILL" 1' }}>
                                                    {hasSession ? "verified_user" : "cancel"}
                                                </span>
                                            </Box>
                                        </Box>
                                        <Button
                                            size="small"
                                            variant={hasSession ? "outlined" : "contained"}
                                            startIcon={<Login />}
                                            onClick={() => openLoginForPlatform(platform.id)}
                                            sx={{ mt: "auto", borderRadius: 3, fontWeight: 800 }}
                                        >
                                            {hasSession ? "Re-login" : "Log in"}
                                        </Button>
                                    </CardContent>
                                </Card>
                            </Grid>
                        )
                    })}
                </Grid>
            )}

            <Dialog open={openAdd} onClose={() => !isLoggingIn && setOpenAdd(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add or re-login account</DialogTitle>
                <DialogContent>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        A browser window will open. Log in, then close it to save the session.
                    </Alert>
                    <FormControl fullWidth margin="normal" disabled={isLoggingIn}>
                        <InputLabel>Platform</InputLabel>
                        <Select
                            value={selectedPlatformId}
                            label="Platform"
                            onChange={e => {
                                const id = e.target.value
                                setSelectedPlatformId(id)
                                const p = SOCIAL_PLATFORMS.find(x => x.id === id)
                                if (p) {
                                    setLoginUrl(p.loginUrl)
                                    if (!newSessionName.trim()) setNewSessionName(id + "-main")
                                }
                            }}
                        >
                            {SOCIAL_PLATFORMS.map(p => (
                                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <TextField
                        label="Session name (e.g. twitter-main)"
                        fullWidth
                        margin="normal"
                        value={newSessionName}
                        onChange={e => setNewSessionName(e.target.value)}
                        disabled={isLoggingIn}
                    />
                    <TextField
                        label="Login URL"
                        fullWidth
                        margin="normal"
                        value={loginUrl}
                        onChange={e => setLoginUrl(e.target.value)}
                        disabled={isLoggingIn}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenAdd(false)} disabled={isLoggingIn}>Cancel</Button>
                    <Button onClick={handleLogin} variant="contained" disabled={isLoggingIn || !newSessionName || !loginUrl}>
                        {isLoggingIn ? "Waiting for browser…" : "Open browser & login"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}
