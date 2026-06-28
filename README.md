# Parkinson's Disease Detection

Detecting Parkinson's disease from vocal measurements using machine learning.

## Dataset
Oxford Parkinson's Disease Detection Dataset (UCI ML Repository)  
195 records · 22 voice features · Binary classification (status: 0/1)

## Approach
- Benchmarked 7 algorithms: Logistic Regression, KNN, SVM, 
  Decision Tree, Random Forest, Gradient Boosting, XGBoost
- Feature scaling with StandardScaler
- Hyperparameter tuning via GridSearchCV (5-fold CV)

## Results
| Model | Accuracy | Recall | F1 |
|-------|----------|--------|----|
| XGBoost (tuned) | 95% | 100% | 97% |
| Random Forest | 95% | 100% | 97% |
| KNN | 95% | 100% | 97% |

**Final model: XGBoost** — chosen for tunability and regularisation.  
Recall prioritised as the key metric to ensure zero missed diagnoses.

## Run it
```bash
pip install ucimlrepo xgboost scikit-learn
```
Then open the notebook — dataset loads automatically.
