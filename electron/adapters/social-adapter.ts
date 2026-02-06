/**
 * Interface for Social Media Adapters.
 * Defines how to extract profile and relationship data from specific platforms.
 */
export interface SocialAdapter {
    platform: string;
    baseUrl: string;
    loginUrl: string;

    /**
     * URL template for profile. Use {id} as placeholder.
     * e.g. "https://mock.social/u/{id}"
     */
    profileUrlTemplate: string;

    /**
     * JS Script to extract profile detailed info.
     * Expected return: {
     *   external_id: string,
     *   username: string,
     *   display_name: string,
     *   avatar_url?: string,
     *   bio?: string,
     *   follower_count?: number,
     *   following_count?: number
     * }
     */
    profileScript: string;

    /**
     * Configuration for extracting connections (followers/following).
     */
    connections: {
        /** URL template for followers list. Use {id} as placeholder. */
        followersUrlTemplate?: string;
        /** URL template for following list. Use {id} as placeholder. */
        followingUrlTemplate?: string;
        /**
         * JS Script to extract a list of users from a scrollable list.
         * Expected return: Array<{ external_id: string, username: string, display_name: string }>
         */
        listScript: string;
        /** Selector to wait for when loading the list */
        listSelector: string;
    };
}

// Example Mock Adapter
export const MockAdapter: SocialAdapter = {
    platform: "mock",
    baseUrl: "https://mock.social",
    loginUrl: "https://mock.social/login",
    profileUrlTemplate: "https://mock.social/u/{id}",
    profileScript: `return {
    external_id: document.querySelector('meta[name="user-id"]').content,
    username: document.querySelector('.username').innerText,
    display_name: document.querySelector('.fullname').innerText,
    avatar_url: document.querySelector('img.avatar').src,
    follower_count: parseInt(document.querySelector('.followers').innerText)
  }`,
    connections: {
        listSelector: ".user-list",
        listScript: `return [...document.querySelectorAll('.user-list-item')].map(el => ({
        external_id: el.dataset.id,
        username: el.querySelector('.u-name').innerText,
        display_name: el.querySelector('.d-name').innerText
    }))`
    }
};
