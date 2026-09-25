# Trained XGBoost Traffic Signal Model

Model: `traffic_signal_xgboost.json`

Purpose:
- Predict adaptive green duration for the active traffic approach.
- Output is bounded to 8–45 seconds to match the simulator's signal limits.

Training:
- 60,000 synthetic traffic states.
- 80/20 train/test split.
- Seed: 42.
- XGBoost regression.

Validation on held-out synthetic states:
- MAE: 1.711 seconds
- RMSE: 2.466 seconds
- R²: 0.9629

IMPORTANT:
The uploaded project did not contain a real labeled traffic dataset or a
trained model checkpoint. Therefore this model is trained on synthetic
traffic states using an expert adaptive-policy target. It is suitable as a
working prototype replacement for the current random-weight DQN, but it
must not be presented as trained on real Gandhipuram/Coimbatore traffic data.
