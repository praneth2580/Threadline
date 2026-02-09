import { useState, useEffect } from "react"
import {
    Box,
    Button,
    Typography,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
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
    MenuItem
} from "@mui/material"
import { Add, Delete, Login, Refresh } from "@mui/icons-material"
import { SOCIAL_PLATFORMS } from "@threadline/constants/platforms.js"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = (window as any).api

export function AccountsManager() {
    const [sessions, setSessions] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [openAdd, setOpenAdd] = useState(false)
    const [newSessionName, setNewSessionName] = useState("")
    const [loginUrl, setLoginUrl] = useState("")
    const [selectedPlatformId, setSelectedPlatformId] = useState("")
    const [isLoggingIn, setIsLoggingIn] = useState(false)

    const loadSessions = async () => {
        if (!api?.scraper?.getSessions) return
        setLoading(true)
        try {
            const list = await api.scraper.getSessions()
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

    const handleLogin = async () => {
        if (!newSessionName.trim() || !loginUrl.trim()) return
        setIsLoggingIn(true)
        try {
            // Interactive login
            await api.scraper.scrape({
                url: loginUrl,
                session: newSessionName,
                interactive: true
            })
            // Refresh list
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
        <Box sx={{ p: 3, maxWidth: 800, mx: "auto" }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <Typography variant="h5" sx={{ flexGrow: 1 }}>Saved Accounts</Typography>
                <Button variant="contained" startIcon={<Add />} onClick={() => setOpenAdd(true)}>
                    Add Account
                </Button>
                <IconButton onClick={loadSessions} sx={{ ml: 1 }}><Refresh /></IconButton>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Log in to social media platforms to save your session (cookies).
                These sessions will be used by the scraper to access protected data like followers/following.
            </Typography>

            {loading ? <CircularProgress /> : (
                <List sx={{ bgcolor: "background.paper", borderRadius: 1, border: 1, borderColor: "divider" }}>
                    {sessions.length === 0 ? (
                        <ListItem>
                            <ListItemText primary="No saved accounts" secondary="Click 'Add Account' to log in to a new platform." />
                        </ListItem>
                    ) : sessions.map(s => (
                        <ListItem key={s} divider>
                            <ListItemText
                                primary={s}
                                secondary="Session saved"
                            />
                            <ListItemSecondaryAction>
                                <Button
                                    size="small"
                                    startIcon={<Login />}
                                    onClick={() => {
                                        // Re-login / Refresh session
                                        setNewSessionName(s)
                                        setLoginUrl("https://google.com") // Default or ask user?
                                        setOpenAdd(true)
                                    }}
                                >
                                    Re-Login
                                </Button>
                            </ListItemSecondaryAction>
                        </ListItem>
                    ))}
                </List>
            )}

            <Dialog open={openAdd} onClose={() => !isLoggingIn && setOpenAdd(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add New Account</DialogTitle>
                <DialogContent>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        A browser window will open. Log in to the site, then close the browser window to save the session.
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
                        label="Session Name (e.g. twitter-main)"
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
                        {isLoggingIn ? "Waiting for Browser..." : "Open Browser & Login"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}
