import axios from 'axios';
import * as qs from 'querystring';

const steroidBackendBaseUrl = 'http://localhost:3088';

interface StateResponse {
    latestRelease: {
        id: number;
        commit: string;
        status: string;
        createdAt: string;
        updatedAt: string;
        codePlaces: {
            id: number;
            createdAt: string;
            updatedAt: string;
            endColumn: number;
            endLine: number;
            executionTime: number;
            fileName: string;
            hitCount: number;
            releaseId: number;
            startColumn: number;
            startLine: number;
            status: string;
            trackerId: number;
            type: string;
            tracker: {
                id: number;
                createdAt: string;
                updatedAt: string;
                name: string;
            }
        }[];
    }
}

export async function getLatestRelease(commits: string[]) {
	try {
		const response = await axios.get<StateResponse>(`${steroidBackendBaseUrl}/dev/getState`, {
			headers: {
				apiKey: '123456',
			},
			params: {
				commits,
			},
			paramsSerializer: params => {
				return qs.stringify(params)
			}
		});

		return response.data.latestRelease;
	} catch (err) {
		console.error(err)
        throw err;
	}
}
