import { Component, type ReactNode } from "react"
import { Box, Alert, Typography, Button } from "@mui/material"

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
    constructor(props: { children: ReactNode }) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error }
    }

    render() {
        if (this.state.hasError) {
            return (
                <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100vh', justifyContent: 'center' }}>
                    <Alert severity="error" variant="filled" sx={{ mb: 2, maxWidth: 600 }}>
                        <Typography variant="h6">Application Crashed</Typography>
                        <Typography variant="body2" sx={{ mt: 1, fontFamily: 'monospace' }}>
                            {this.state.error?.message}
                        </Typography>
                    </Alert>
                    <Button variant="contained" onClick={() => window.location.reload()}>Reload Application</Button>
                </Box>
            )
        }
        return this.props.children
    }
}
