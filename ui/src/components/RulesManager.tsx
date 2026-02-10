import { useState, useEffect } from "react"
import {
    Box,
    Typography,
    List,
    ListItem,
    ListItemText,
    Paper,
    CircularProgress,
    Alert
} from "@mui/material"
import { getApiBase } from "../api"

interface SocialAdapter {
    platform: string
    baseUrl: string
    loginUrl: string
    profileUrlTemplate: string
    connections: { listSelector: string }
}

async function getAdapters(): Promise<SocialAdapter[]> {
    const base = await getApiBase()
    const r = await fetch(`${base}/api/adapters`)
    if (!r.ok) throw new Error(await r.text())
    return r.json()
}

export function RulesManager() {
    const [adapters, setAdapters] = useState<SocialAdapter[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        getAdapters()
            .then(setAdapters)
            .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
            .finally(() => setLoading(false))
    }, [])

    if (loading) {
        return (
            <Box sx={{ p: 3, display: "flex", justifyContent: "center" }}>
                <CircularProgress />
            </Box>
        )
    }

    if (error) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">{error}</Alert>
            </Box>
        )
    }

    return (
        <Box sx={{ p: 3, maxWidth: 800, mx: "auto" }}>
            <Typography variant="h5" sx={{ mb: 1 }}>Scraping Rules</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Rules are defined statically in code. Edit <code>src/constants/adapters.js</code> to change them.
            </Typography>

            <Paper variant="outlined">
                <List>
                    {adapters.length === 0 ? (
                        <ListItem>
                            <ListItemText primary="No rules" secondary="Add adapters in src/constants/adapters.js" />
                        </ListItem>
                    ) : adapters.map((a) => (
                        <ListItem key={a.platform} divider>
                            <ListItemText
                                primary={a.platform}
                                secondary={`${a.baseUrl} · ${a.connections?.listSelector ?? "—"}`}
                            />
                        </ListItem>
                    ))}
                </List>
            </Paper>
        </Box>
    )
}
