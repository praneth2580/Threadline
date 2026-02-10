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
    Grid
} from "@mui/material"
import { Add, Login, Refresh } from "@mui/icons-material"
import { SOCIAL_PLATFORMS } from "@threadline/constants/platforms.js"
import { getApiBase } from "../api"

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
    const [sessions, setSessions] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [openAdd, setOpenAdd] = useState(false)
    const [newSessionName, setNewSessionName] = useState("")
    const [loginUrl, setLoginUrl] = useState("")
    const [selectedPlatformId, setSelectedPlatformId] = useState("")
    const [isLoggingIn, setIsLoggingIn] = useState(false)

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

    return (
        <Box sx={{ p: 3, maxWidth: 960, mx: "auto" }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <Typography variant="h5" sx={{ flexGrow: 1 }}>Accounts</Typography>
                <Button variant="outlined" startIcon={<Add />} onClick={() => setOpenAdd(true)}>
                    Add account (custom)
                </Button>
                <IconButton onClick={loadSessions} sx={{ ml: 1 }} aria-label="Refresh"><Refresh /></IconButton>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Log in to social platforms to save your session. Each card uses the statically defined list of platforms.
            </Typography>

            {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>
            ) : (
                <Grid container spacing={2}>
                    {SOCIAL_PLATFORMS.map((platform) => {
                        const hasSession = hasSessionForPlatform(sessions, platform.id)
                        return (
                            <Grid item xs={12} sm={6} md={4} key={platform.id}>
                                <Card variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                                    <CardContent sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                                        <Typography fontWeight={600}>{platform.name}</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {hasSession ? "Session saved" : "Not logged in"}
                                        </Typography>
                                        <Button
                                            size="small"
                                            variant={hasSession ? "outlined" : "contained"}
                                            startIcon={<Login />}
                                            onClick={() => openLoginForPlatform(platform.id)}
                                            sx={{ mt: "auto" }}
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
